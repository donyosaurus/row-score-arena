CREATE OR REPLACE FUNCTION public.process_deposit_atomic(
  _user_id uuid,
  _wallet_id uuid,
  _amount_cents bigint,
  _payment_provider_reference text,
  _payment_method text,
  _idempotency_key text,
  _state_code text
)
RETURNS TABLE (
  allowed boolean,
  reason text,
  transaction_id uuid,
  available_balance_cents bigint,
  was_duplicate boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_transaction_id uuid;
  _existing_status transaction_status;
  _wallet_id_check uuid;
  _new_transaction_id uuid;
  _wallet_result record;
  _available_balance_cents bigint;
  _current_balance bigint;
BEGIN
  -- STEP 1: Serialize concurrent deposit attempts for this user
  PERFORM pg_advisory_xact_lock(hashtext('deposit:' || _user_id::text));

  -- STEP 2: Idempotency check
  SELECT id, status INTO _existing_transaction_id, _existing_status
  FROM transactions
  WHERE idempotency_key = _idempotency_key AND user_id = _user_id;

  IF FOUND THEN
    IF _existing_status = 'completed' THEN
      -- Safe replay: re-read current wallet balance and return existing transaction id
      SELECT available_balance INTO _current_balance
      FROM wallets
      WHERE id = _wallet_id AND user_id = _user_id;

      RETURN QUERY SELECT true, 'approved'::text, _existing_transaction_id, _current_balance, true;
      RETURN;
    ELSE
      -- Existing pending/processing transaction with same key
      RETURN QUERY SELECT false, 'idempotency_key_in_progress'::text, _existing_transaction_id, NULL::bigint, false;
      RETURN;
    END IF;
  END IF;

  -- STEP 3: Validate amount range (defense in depth; client/edge also validates)
  IF _amount_cents < 500 OR _amount_cents > 50000 THEN
    RETURN QUERY SELECT false, 'per_transaction_limit'::text, NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;

  -- STEP 4: Responsible gaming check (self-exclusion / monthly cap)
  -- check_deposit_limit RAISES on violation; translate known raises into structured returns,
  -- re-raise unknown errors so they aren't silently swallowed.
  BEGIN
    PERFORM check_deposit_limit(_user_id, _amount_cents);
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%self-excluded%' THEN
        RETURN QUERY SELECT false, 'self_excluded'::text, NULL::uuid, NULL::bigint, false;
        RETURN;
      ELSIF SQLERRM LIKE '%monthly limit%' THEN
        RETURN QUERY SELECT false, 'monthly_deposit_limit'::text, NULL::uuid, NULL::bigint, false;
        RETURN;
      ELSE
        RAISE;
      END IF;
  END;

  -- STEP 5: Lock the wallet row (defense in depth)
  SELECT id INTO _wallet_id_check
  FROM wallets
  WHERE id = _wallet_id AND user_id = _user_id
  FOR UPDATE;

  IF _wallet_id_check IS NULL THEN
    RETURN QUERY SELECT false, 'wallet_not_found'::text, NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;

  -- STEP 6: Insert the deposit transaction row
  -- transactions.amount stored as positive cents; direction conveyed by type='deposit'
  INSERT INTO transactions (
    user_id, wallet_id, type, amount, status,
    reference_id, reference_type, description, metadata,
    idempotency_key, state_code, deposit_timestamp, completed_at
  )
  VALUES (
    _user_id,
    _wallet_id,
    'deposit',
    _amount_cents,
    'completed',
    _payment_provider_reference,         -- opaque payment provider id, stored as text
    'payment_provider',
    'Deposit via ' || _payment_method,
    jsonb_build_object('payment_method', _payment_method),
    _idempotency_key,
    _state_code,
    now(),
    now()
  )
  RETURNING id INTO _new_transaction_id;

  -- STEP 7: Credit the wallet via existing RPC
  SELECT * INTO _wallet_result
  FROM update_wallet_balance(
    _wallet_id := _wallet_id,
    _available_delta := _amount_cents,
    _pending_delta := 0,
    _lifetime_deposits_delta := _amount_cents
  );

  _available_balance_cents := _wallet_result.available_balance;

  -- STEP 8: Insert ledger entry
  -- transaction_type uppercase per CHECK constraint
  -- amount POSITIVE because deposits are credits
  -- reference_id = transaction.id (double-entry convention: ledger references the transaction it explains)
  INSERT INTO ledger_entries (user_id, transaction_type, amount, reference_id, description)
  VALUES (
    _user_id,
    'DEPOSIT',
    _amount_cents,
    _new_transaction_id,
    'Deposit credit'
  );

  -- STEP 9: Success
  RETURN QUERY SELECT
    true,
    'approved'::text,
    _new_transaction_id,
    _available_balance_cents,
    false;
END;
$$;