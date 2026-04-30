CREATE OR REPLACE FUNCTION public.initiate_withdrawal_atomic(_user_id uuid, _wallet_id uuid, _amount_cents bigint, _state_code text)
 RETURNS TABLE(allowed boolean, reason text, transaction_id uuid, today_total_cents bigint, available_balance_cents bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wallet_id_check uuid;
  _available_balance bigint;
  _pending_count integer;
  _last_completed_at timestamptz;
  _today_start timestamptz;
  _today_total bigint;
  _recent_deposit_count integer;
  _new_transaction_id uuid;
BEGIN
  -- 1. Serialize concurrent requests for the same user
  PERFORM pg_advisory_xact_lock(hashtext(_user_id::text));

  -- 2. Per-transaction range: $5 min, $500 max
  IF _amount_cents > 50000 OR _amount_cents < 500 THEN
    RETURN QUERY SELECT false, 'per_transaction_limit'::text, NULL::uuid, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  -- 3. Lock the wallet row
  SELECT id, available_balance
    INTO _wallet_id_check, _available_balance
  FROM wallets
  WHERE id = _wallet_id AND user_id = _user_id
  FOR UPDATE;

  IF _wallet_id_check IS NULL THEN
    RETURN QUERY SELECT false, 'wallet_not_found'::text, NULL::uuid, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  -- 4. Available balance check
  IF _available_balance < _amount_cents THEN
    RETURN QUERY SELECT false, 'insufficient_balance'::text, NULL::uuid, 0::bigint, _available_balance;
    RETURN;
  END IF;

  -- 5. No pending withdrawals allowed
  SELECT COUNT(*) INTO _pending_count
  FROM transactions
  WHERE user_id = _user_id
    AND type = 'withdrawal'
    AND status = 'pending';

  IF _pending_count > 0 THEN
    RETURN QUERY SELECT false, 'pending_withdrawal_exists'::text, NULL::uuid, 0::bigint, _available_balance;
    RETURN;
  END IF;

  -- 6. 10-minute cooldown vs last COMPLETED withdrawal
  SELECT MAX(created_at) INTO _last_completed_at
  FROM transactions
  WHERE user_id = _user_id
    AND type = 'withdrawal'
    AND status = 'completed';

  IF _last_completed_at IS NOT NULL AND _last_completed_at > (now() - interval '10 minutes') THEN
    RETURN QUERY SELECT false, 'cooldown'::text, NULL::uuid, 0::bigint, _available_balance;
    RETURN;
  END IF;

  -- 7. Daily cap ($500) since UTC midnight, includes pending + completed
  _today_start := date_trunc('day', now() AT TIME ZONE 'UTC');

  SELECT COALESCE(SUM(ABS(amount)), 0)::bigint INTO _today_total
  FROM transactions
  WHERE user_id = _user_id
    AND type = 'withdrawal'
    AND status IN ('completed', 'pending')
    AND created_at >= _today_start;

  IF (_today_total + _amount_cents) > 50000 THEN
    RETURN QUERY SELECT false, 'daily_limit'::text, NULL::uuid, _today_total, _available_balance;
    RETURN;
  END IF;

  -- 8. 24-hour deposit hold
  SELECT COUNT(*) INTO _recent_deposit_count
  FROM transactions
  WHERE user_id = _user_id
    AND type = 'deposit'
    AND status = 'completed'
    AND created_at >= (now() - interval '24 hours');

  IF _recent_deposit_count > 0 THEN
    RETURN QUERY SELECT false, 'deposit_hold_24h'::text, NULL::uuid, _today_total, _available_balance;
    RETURN;
  END IF;

  -- 9. Insert pending withdrawal
  -- transactions.amount stored as positive cents; direction conveyed by type='withdrawal'
  INSERT INTO transactions (user_id, wallet_id, type, amount, status, description)
  VALUES (_user_id, _wallet_id, 'withdrawal', _amount_cents, 'pending', 'Withdrawal request')
  RETURNING id INTO _new_transaction_id;

  -- 10. Move funds from available to pending
  UPDATE wallets
  SET available_balance = available_balance - _amount_cents,
      pending_balance = pending_balance + _amount_cents,
      updated_at = now()
  WHERE id = _wallet_id;

  -- 11. Re-read updated available balance
  SELECT available_balance INTO _available_balance
  FROM wallets WHERE id = _wallet_id;

  -- 12. Success
  RETURN QUERY SELECT
    true,
    'approved'::text,
    _new_transaction_id,
    (_today_total + _amount_cents),
    _available_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enter_contest_pool_atomic(_user_id uuid, _wallet_id uuid, _contest_template_id uuid, _tier_name text, _picks jsonb, _state_code text)
 RETURNS TABLE(allowed boolean, reason text, entry_id uuid, pool_id uuid, current_entries integer, max_entries integer, available_balance_cents bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  MIN_UNIQUE_EVENTS CONSTANT integer := 2;
  H2H_MAX_ENTRIES CONSTANT integer := 2;

  _exclusion_until timestamptz;
  _event_ids text[];
  _unique_event_count integer;
  _total_event_count integer;
  _template_check uuid;
  _wallet_id_check uuid;
  _available_balance bigint;
  _candidate record;
  _target_pool_id uuid;
  _pool_fee_cents bigint;
  _pool_for_clone uuid;
  _has_overflow_candidate boolean := false;
  _matching_pool_exists boolean := false;
  _new_pool_id uuid;
  _wallet_result record;
  _transaction_id uuid;
  _entry_id uuid;
  _post_increment_entries integer;
  _pool_max integer;
BEGIN
  -- STEP 1: Serialize concurrent entry attempts per user
  PERFORM pg_advisory_xact_lock(hashtext('contest_entry:' || _user_id::text));

  -- STEP 2: Self-exclusion check
  SELECT self_exclusion_until INTO _exclusion_until
  FROM responsible_gaming
  WHERE user_id = _user_id;

  IF _exclusion_until IS NOT NULL AND _exclusion_until > now() THEN
    RETURN QUERY SELECT false, 'self_excluded'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  -- STEP 3: Validate picks structure
  SELECT array_agg(elem->>'event_id'), count(*)
  INTO _event_ids, _total_event_count
  FROM jsonb_array_elements(_picks) AS elem;

  IF _event_ids IS NULL THEN
    RETURN QUERY SELECT false, 'insufficient_events'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  SELECT count(DISTINCT e) INTO _unique_event_count
  FROM unnest(_event_ids) AS e;

  IF _unique_event_count < _total_event_count THEN
    RETURN QUERY SELECT false, 'duplicate_event'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  IF _unique_event_count < MIN_UNIQUE_EVENTS THEN
    RETURN QUERY SELECT false, 'insufficient_events'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  -- STEP 4: Validate template exists
  SELECT id INTO _template_check
  FROM contest_templates
  WHERE id = _contest_template_id;

  IF _template_check IS NULL THEN
    RETURN QUERY SELECT false, 'template_not_found'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  -- STEP 5: Lock and read the wallet
  SELECT id, available_balance INTO _wallet_id_check, _available_balance
  FROM wallets
  WHERE id = _wallet_id AND user_id = _user_id
  FOR UPDATE;

  IF _wallet_id_check IS NULL THEN
    RETURN QUERY SELECT false, 'wallet_not_found'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  -- STEP 6: Pool selection
  -- 6a: Find candidate pools (locked FOR UPDATE), preferring fuller then older
  FOR _candidate IN
    SELECT id, current_entries, max_entries, lock_time, allow_overflow, entry_fee_cents, created_at
    FROM contest_pools
    WHERE contest_template_id = _contest_template_id
      AND status = 'open'
      AND (_tier_name IS NULL OR tier_name = _tier_name)
    ORDER BY current_entries DESC, created_at ASC
    FOR UPDATE
  LOOP
    _matching_pool_exists := true;

    IF _candidate.allow_overflow AND _candidate.lock_time > now() THEN
      _has_overflow_candidate := true;
      _pool_for_clone := _candidate.id;
    END IF;

    IF _candidate.lock_time <= now() THEN
      CONTINUE;
    END IF;

    IF _candidate.current_entries >= _candidate.max_entries THEN
      CONTINUE;
    END IF;

    IF _candidate.max_entries = H2H_MAX_ENTRIES THEN
      IF EXISTS (
        SELECT 1 FROM contest_entries
        WHERE pool_id = _candidate.id AND user_id = _user_id
        LIMIT 1
      ) THEN
        CONTINUE;
      END IF;
    END IF;

    _target_pool_id := _candidate.id;
    _pool_fee_cents := _candidate.entry_fee_cents;
    EXIT;
  END LOOP;

  -- 6b: No usable candidate
  IF _target_pool_id IS NULL THEN
    IF NOT _matching_pool_exists THEN
      RETURN QUERY SELECT false, 'no_pool_for_tier'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::bigint;
      RETURN;
    END IF;

    IF NOT _has_overflow_candidate THEN
      RETURN QUERY SELECT false, 'all_pools_full'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::bigint;
      RETURN;
    END IF;

    SELECT id INTO _pool_for_clone
    FROM contest_pools
    WHERE contest_template_id = _contest_template_id
      AND (_tier_name IS NULL OR tier_name = _tier_name)
      AND allow_overflow = true
      AND lock_time > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF _pool_for_clone IS NULL THEN
      RETURN QUERY SELECT false, 'all_pools_full'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::bigint;
      RETURN;
    END IF;

    _new_pool_id := clone_contest_pool(_pool_for_clone);

    SELECT id, entry_fee_cents INTO _target_pool_id, _pool_fee_cents
    FROM contest_pools
    WHERE id = _new_pool_id
    FOR UPDATE;
  END IF;

  -- STEP 7: Validate fee and balance
  IF _pool_fee_cents IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_pool_fee'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  IF _available_balance < _pool_fee_cents THEN
    RETURN QUERY SELECT false, 'insufficient_balance'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, _available_balance;
    RETURN;
  END IF;

  -- STEP 8: Debit wallet via existing RPC
  SELECT * INTO _wallet_result
  FROM update_wallet_balance(
    _wallet_id := _wallet_id,
    _available_delta := -_pool_fee_cents,
    _pending_delta := 0
  );

  _available_balance := _wallet_result.available_balance;

  -- STEP 9: Insert transaction
  -- transactions.amount stored as positive cents; direction conveyed by type='entry_fee'
  INSERT INTO transactions (user_id, wallet_id, type, amount, status, description)
  VALUES (
    _user_id,
    _wallet_id,
    'entry_fee',
    _pool_fee_cents,
    'completed',
    'Contest entry fee for ' || COALESCE(_tier_name, 'untiered') || ' tier'
  )
  RETURNING id INTO _transaction_id;

  -- STEP 10: Insert ledger entry
  -- reference_id = transaction_id (double-entry convention: ledger references the transaction it explains)
  INSERT INTO ledger_entries (user_id, transaction_type, amount, reference_id, description)
  VALUES (
    _user_id,
    'ENTRY_FEE',
    -_pool_fee_cents,
    _transaction_id,
    'Contest entry fee debit'
  );

  -- STEP 11: Insert contest entry (entry_fee_cents from authoritative pool value)
  INSERT INTO contest_entries (user_id, pool_id, contest_template_id, picks, entry_fee_cents, state_code, tier_name, status)
  VALUES (
    _user_id,
    _target_pool_id,
    _contest_template_id,
    _picks,
    _pool_fee_cents,
    _state_code,
    _tier_name,
    'active'
  )
  RETURNING id INTO _entry_id;

  -- STEP 12: Atomic capacity-check increment
  UPDATE contest_pools
  SET current_entries = current_entries + 1
  WHERE id = _target_pool_id AND current_entries < max_entries
  RETURNING current_entries, max_entries INTO _post_increment_entries, _pool_max;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pool_capacity_violated';
  END IF;

  -- STEP 13: Success
  RETURN QUERY SELECT
    true,
    'approved'::text,
    _entry_id,
    _target_pool_id,
    _post_increment_entries,
    _pool_max,
    _available_balance;
END;
$function$;