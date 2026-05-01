-- Drop the existing admin_void_contest function (replaced by void_contest_pool_atomic)
DROP FUNCTION IF EXISTS public.admin_void_contest(uuid);
DROP FUNCTION IF EXISTS public.admin_void_contest(uuid, uuid);
DROP FUNCTION IF EXISTS public.admin_void_contest(uuid, uuid, text);

-- Create the new atomic void function
CREATE OR REPLACE FUNCTION public.void_contest_pool_atomic(
  _pool_id uuid,
  _admin_user_id uuid,
  _reason text DEFAULT NULL
)
RETURNS TABLE (
  allowed boolean,
  reason text,
  was_already_voided boolean,
  pool_id uuid,
  total_refunded_cents bigint,
  refunded_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pool                 contest_pools%ROWTYPE;
  _rec                  RECORD;
  _wallet_id            uuid;
  _transaction_id       uuid;
  _total_refunded_cents bigint := 0;
  _refunded_count       integer := 0;
BEGIN
  -- STEP 0 — Verify caller is admin (defense in depth; EXECUTE is also locked
  -- to service_role at GRANT level, so this is the second layer)
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'unauthorized: caller is not an admin';
  END IF;

  -- STEP 1 — Advisory lock to serialize concurrent void attempts on this pool.
  -- Distinct from the row-level FOR UPDATE lock; prevents racing on adjacent
  -- per-entry operations even when nothing is currently locked.
  PERFORM pg_advisory_xact_lock(hashtext('void_pool:' || _pool_id::text));

  -- STEP 2 — Lock the pool row and read its current state.
  SELECT * INTO _pool
  FROM contest_pools
  WHERE id = _pool_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false,
      'pool_not_found'::text,
      false,
      _pool_id,
      0::bigint,
      0;
    RETURN;
  END IF;

  -- STEP 3 — Idempotency: if pool is already voided, return success with flag.
  IF _pool.status = 'voided' THEN
    RETURN QUERY SELECT
      true,
      'approved'::text,
      true,
      _pool_id,
      0::bigint,
      0;
    RETURN;
  END IF;

  -- STEP 4 — Forbid voiding a settled pool. Settled means real money has
  -- already been paid out; reversing that requires a separate clawback flow,
  -- not a void.
  IF _pool.status = 'settled' THEN
    RETURN QUERY SELECT
      false,
      'cannot_void_settled'::text,
      false,
      _pool_id,
      0::bigint,
      0;
    RETURN;
  END IF;

  -- STEP 5 — Refund every active entry: insert transaction, credit wallet,
  -- write ledger entry, mark entry voided.
  FOR _rec IN
    SELECT id AS entry_id, user_id, entry_fee_cents
    FROM contest_entries
    WHERE pool_id = _pool_id AND status = 'active'
    ORDER BY user_id ASC
  LOOP
    -- Resolve wallet for this user
    SELECT id INTO _wallet_id FROM wallets WHERE user_id = _rec.user_id;
    IF _wallet_id IS NULL THEN
      RAISE EXCEPTION 'Wallet not found for user % during void refund', _rec.user_id;
    END IF;

    -- a. Insert refund transaction. Amount stored POSITIVE; direction is
    -- conveyed by type='refund'. This row is what compliance export reads.
    INSERT INTO transactions (
      user_id, wallet_id, type, amount, status, description, reference_type, reference_id
    ) VALUES (
      _rec.user_id,
      _wallet_id,
      'refund',
      _rec.entry_fee_cents,
      'completed',
      COALESCE('Contest voided: ' || _reason, 'Contest voided'),
      'contest_pool',
      _pool_id::text
    )
    RETURNING id INTO _transaction_id;

    -- b. Credit wallet. Refunds are NOT lifetime winnings or deposits — only
    -- the available balance moves.
    PERFORM update_wallet_balance(
      _wallet_id,
      _rec.entry_fee_cents,  -- _available_delta
      0,                      -- _pending_delta
      0,                      -- _lifetime_deposits_delta
      0,                      -- _lifetime_withdrawals_delta
      0                       -- _lifetime_winnings_delta
    );

    -- c. Insert ledger entry. Sign-bearing: refund is a credit → POSITIVE.
    -- reference_id points to transactions.id (Fix 9 convention), not pool_id.
    INSERT INTO ledger_entries (
      user_id, transaction_type, amount, reference_id, description
    ) VALUES (
      _rec.user_id,
      'REFUND',
      _rec.entry_fee_cents,
      _transaction_id,
      'Contest void refund'
    );

    -- d. Mark entry voided (terminal state for refunded entries; NOT settled).
    UPDATE contest_entries
    SET status = 'voided',
        payout_cents = _rec.entry_fee_cents,
        updated_at = now()
    WHERE id = _rec.entry_id;

    -- e. Accumulate totals for the return shape.
    _total_refunded_cents := _total_refunded_cents + _rec.entry_fee_cents;
    _refunded_count := _refunded_count + 1;
  END LOOP;

  -- STEP 6 — Finalize pool. (contest_pools has no voided_at / void_reason
  -- columns in the current schema — verified at migration time — so we only
  -- update status. The reason is preserved on each transaction's description.)
  UPDATE contest_pools
  SET status = 'voided'
  WHERE id = _pool_id;

  -- STEP 7 — Success.
  RETURN QUERY SELECT
    true,
    'approved'::text,
    false,
    _pool_id,
    _total_refunded_cents,
    _refunded_count;
END;
$$;

-- Lock down EXECUTE permissions (mirror settle_contest_pool_atomic).
REVOKE EXECUTE ON FUNCTION public.void_contest_pool_atomic(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.void_contest_pool_atomic(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.void_contest_pool_atomic(uuid, uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.void_contest_pool_atomic(uuid, uuid, text) TO service_role;