-- =====================================================================
-- HARDENING: settle_contest_pool_atomic + void_contest_pool_atomic
-- CHANGE 1: Orphan admin protection (JOIN auth.users) — both functions
-- CHANGE 2: Fail closed on settled entries in void target — void only
-- CHANGE 3: Zero/negative entry_fee_cents handled gracefully — both
-- CHANGE 4: Empty-string reason produces clean description — void only
-- No GRANT/REVOKE changes; signatures and return shapes unchanged.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.settle_contest_pool_atomic(
  _pool_id uuid,
  _admin_user_id uuid
)
RETURNS TABLE (
  allowed boolean,
  reason text,
  was_already_settled boolean,
  pool_id uuid,
  total_payout_cents bigint,
  winners_count integer,
  is_tie_refund boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pool contest_pools%ROWTYPE;
  _is_tie_refund boolean := false;
  _total_payout_cents bigint := 0;
  _winners_count integer := 0;
  _transaction_id uuid;
  _wallet_id uuid;
  _rank1_count integer;
  _active_count integer;
  _rec record;
BEGIN
  -- STEP 0: Verify caller is admin (defense in depth)
  -- _admin_user_id is now used for authorization, not just audit attribution.
  -- EXECUTE is restricted to service_role; service_role is only used by trusted
  -- edge functions that have already authenticated the caller and pass req.user.id.
  -- Orphan-admin protection (CHANGE 1): JOIN auth.users so a stale user_roles
  -- row whose owning auth.users account was deleted cannot pass authorization.
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.user_id = _admin_user_id
      AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'unauthorized: caller is not an admin';
  END IF;

  -- STEP 1: Lock pool row to serialize concurrent settlement attempts
  SELECT * INTO _pool FROM contest_pools WHERE id = _pool_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'pool_not_found'::text, false, NULL::uuid, 0::bigint, 0, false;
    RETURN;
  END IF;

  -- STEP 2: Idempotency — already settled means we're done
  IF _pool.status = 'settled' THEN
    RETURN QUERY SELECT true, 'approved'::text, true, _pool_id, 0::bigint, 0, false;
    RETURN;
  END IF;

  -- STEP 3: Status precondition — pool must be scored
  IF _pool.status <> 'scoring_completed' THEN
    RETURN QUERY SELECT false, 'wrong_pool_status'::text, false, _pool_id, 0::bigint, 0, false;
    RETURN;
  END IF;

  -- STEP 4: Determine settlement mode (H2H tie-refund detection)
  -- An H2H tie-refund pool has every active entry tied at rank=1 and the
  -- count of rank=1 entries equals max_entries (e.g., 2-of-2 tied in H2H).
  -- Tightened (CHANGE 3): require winner_ids to be exactly empty (NULL fails closed).
  -- Tightened (CHANGE 4): require max_entries = 2 (H2H-only).
  SELECT
    COUNT(*) FILTER (WHERE cs.rank = 1),
    COUNT(*)
  INTO _rank1_count, _active_count
  FROM contest_scores cs
  JOIN contest_entries ce ON ce.id = cs.entry_id
  WHERE cs.pool_id = _pool_id AND ce.status = 'active';

  IF _active_count > 0
     AND _rank1_count = _active_count
     AND _rank1_count = _pool.max_entries
     AND _pool.max_entries = 2
     AND _pool.winner_ids = ARRAY[]::uuid[]
  THEN
    _is_tie_refund := true;
  END IF;

  -- STEP 5A: H2H tie-refund branch — refund each player their entry fee
  IF _is_tie_refund THEN
    FOR _rec IN
      SELECT cs.id AS score_id, cs.entry_id, cs.user_id, ce.entry_fee_cents
      FROM contest_scores cs
      JOIN contest_entries ce ON ce.id = cs.entry_id
      WHERE cs.pool_id = _pool_id AND ce.status = 'active'
      ORDER BY cs.user_id ASC
    LOOP
      -- Free-entry guard (CHANGE 3): only touch wallet/transaction/ledger when
      -- there is actually money to move. Score/entry updates and accumulators
      -- still run regardless so promotional ($0) pools settle cleanly.
      IF _rec.entry_fee_cents > 0 THEN
        -- Resolve wallet
        SELECT id INTO _wallet_id FROM wallets WHERE user_id = _rec.user_id;
        IF _wallet_id IS NULL THEN
          RAISE EXCEPTION 'Wallet not found for user % during tie refund', _rec.user_id;
        END IF;

        -- a. Insert transaction (positive amount; direction in type)
        INSERT INTO transactions (
          user_id, wallet_id, type, amount, status, description, reference_type, reference_id
        ) VALUES (
          _rec.user_id, _wallet_id, 'refund', _rec.entry_fee_cents, 'completed',
          'H2H tie refund', 'contest_pool', _pool_id::text
        ) RETURNING id INTO _transaction_id;

        -- b. Credit wallet (refund is NOT lifetime winnings)
        PERFORM update_wallet_balance(
          _wallet_id,
          _rec.entry_fee_cents,  -- _available_delta
          0,                      -- _pending_delta
          0,                      -- _lifetime_deposits_delta
          0,                      -- _lifetime_withdrawals_delta
          0                       -- _lifetime_winnings_delta (refunds aren't winnings)
        );

        -- c. Ledger entry (signed amount; refund credits user => positive)
        INSERT INTO ledger_entries (
          user_id, transaction_type, amount, reference_id, description
        ) VALUES (
          _rec.user_id, 'REFUND', _rec.entry_fee_cents, _transaction_id, 'H2H tie refund'
        );
      END IF;

      -- d. Mark score row payout
      UPDATE contest_scores SET payout_cents = _rec.entry_fee_cents, is_winner = false
      WHERE id = _rec.score_id;

      -- e. Mark entry settled
      UPDATE contest_entries SET payout_cents = _rec.entry_fee_cents, status = 'settled'
      WHERE id = _rec.entry_id;

      -- f. Accumulate
      _total_payout_cents := _total_payout_cents + _rec.entry_fee_cents;
      _winners_count := _winners_count + 1;
    END LOOP;

  ELSE
    -- STEP 5B: Standard payout branch
    IF _pool.payout_structure IS NULL OR _pool.payout_structure = '{}'::jsonb THEN
      RETURN QUERY SELECT false, 'no_payout_structure'::text, false, _pool_id, 0::bigint, 0, false;
      RETURN;
    END IF;

    -- Compute per-player payouts using sum-and-split rule for tied ranks.
    -- For a tie group at rank R with N tied players:
    --   sum   = sum of payout_structure[R..R+N-1] (missing slots count as 0)
    --   base  = floor(sum / N)
    --   extra = sum - base*N  (remainder cents)
    --   First `extra` players (ORDER BY user_id) get base+1; others get base.
    FOR _rec IN
      WITH ranked_players AS (
        SELECT
          cs.id AS score_id,
          cs.entry_id,
          cs.user_id,
          cs.rank,
          ce.entry_fee_cents,
          ROW_NUMBER() OVER (PARTITION BY cs.rank ORDER BY cs.user_id ASC) AS tie_position,
          COUNT(*)    OVER (PARTITION BY cs.rank) AS tie_count
        FROM contest_scores cs
        JOIN contest_entries ce ON ce.id = cs.entry_id
        WHERE cs.pool_id = _pool_id AND ce.status = 'active'
      ),
      payout_calc AS (
        SELECT
          rp.*,
          (
            SELECT COALESCE(SUM(COALESCE((_pool.payout_structure ->> r::text)::bigint, 0)), 0)
            FROM generate_series(rp.rank, rp.rank + rp.tie_count - 1) AS r
          ) AS group_total_cents
        FROM ranked_players rp
      )
      SELECT
        pc.score_id,
        pc.entry_id,
        pc.user_id,
        pc.rank,
        pc.tie_count,
        pc.group_total_cents,
        pc.entry_fee_cents,
        (
          floor(pc.group_total_cents::numeric / pc.tie_count)::bigint
          + CASE
              WHEN pc.tie_position <=
                   (pc.group_total_cents - floor(pc.group_total_cents::numeric / pc.tie_count)::bigint * pc.tie_count)
              THEN 1 ELSE 0
            END
        ) AS payout_cents
      FROM payout_calc pc
      ORDER BY pc.rank ASC, pc.tie_position ASC
    LOOP
      IF _rec.payout_cents > 0 THEN
        -- Free-entry guard (CHANGE 3): a $0 entry-fee pool can still have a
        -- payout_cents>0 only if payout_structure is funded by something other
        -- than entry fees (e.g., promotional rake). The wallet write itself is
        -- gated on payout_cents > 0 above; the entry_fee guard below applies
        -- to the per-payout transaction insertion which we keep, since the
        -- payout amount itself is what gets written. No additional gate needed
        -- here — the existing IF _rec.payout_cents > 0 already prevents the
        -- amount=0 CHECK violation for this branch.
        -- Resolve wallet
        SELECT id INTO _wallet_id FROM wallets WHERE user_id = _rec.user_id;
        IF _wallet_id IS NULL THEN
          RAISE EXCEPTION 'Wallet not found for user % during payout', _rec.user_id;
        END IF;

        -- a. Insert transaction (positive amount)
        INSERT INTO transactions (
          user_id, wallet_id, type, amount, status, description, reference_type, reference_id
        ) VALUES (
          _rec.user_id, _wallet_id, 'payout', _rec.payout_cents, 'completed',
          'Contest pool payout', 'contest_pool', _pool_id::text
        ) RETURNING id INTO _transaction_id;

        -- b. Credit wallet AND increment lifetime winnings
        -- update_wallet_balance signature: (_wallet_id, _available_delta, _pending_delta, _lifetime_deposits_delta, _lifetime_withdrawals_delta, _lifetime_winnings_delta)
        -- Use positional args for available + winnings.
        PERFORM update_wallet_balance(
          _wallet_id,
          _rec.payout_cents,  -- _available_delta
          0,                   -- _pending_delta
          0,                   -- _lifetime_deposits_delta
          0,                   -- _lifetime_withdrawals_delta
          _rec.payout_cents   -- _lifetime_winnings_delta
        );

        -- c. Ledger entry
        INSERT INTO ledger_entries (
          user_id, transaction_type, amount, reference_id, description
        ) VALUES (
          _rec.user_id, 'PRIZE_PAYOUT', _rec.payout_cents, _transaction_id, 'Contest pool payout'
        );

        -- d. Mark score row
        UPDATE contest_scores
        SET payout_cents = _rec.payout_cents, is_winner = true
        WHERE id = _rec.score_id;

        -- e. Mark entry settled
        UPDATE contest_entries
        SET payout_cents = _rec.payout_cents, status = 'settled'
        WHERE id = _rec.entry_id;

        -- f. Accumulate
        _total_payout_cents := _total_payout_cents + _rec.payout_cents;
        _winners_count := _winners_count + 1;
      ELSE
        -- Zero-payout score row: still record the zero and we'll settle entry below.
        UPDATE contest_scores
        SET payout_cents = 0, is_winner = false
        WHERE id = _rec.score_id;
      END IF;
    END LOOP;
  END IF;

  -- STEP 5C: Verify all active entries have score rows; fail closed if any are missing.
  -- Applies to BOTH branches (tie-refund and standard) as defense-in-depth.
  -- Hides nothing: a missing score row signals a partial/failed scoring run and
  -- must not be silently settled with payout_cents=0.
  IF EXISTS (
    SELECT 1
    FROM contest_entries ce
    WHERE ce.pool_id = _pool_id
      AND ce.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM contest_scores cs
        WHERE cs.entry_id = ce.id
      )
  ) THEN
    RAISE EXCEPTION 'data integrity error: pool % has active entries without contest_scores rows', _pool_id;
  END IF;

  -- All active entries have score rows; mark them all settled (some already updated
  -- in 5A/5B's IF/ELSE branches; this catches any edge cases like score rows that
  -- didn't match the FOR loop).
  UPDATE contest_entries
  SET payout_cents = COALESCE(payout_cents, 0), status = 'settled'
  WHERE pool_id = _pool_id AND status = 'active';

  -- STEP 6: Sanity check — total paid must not exceed prize pool
  -- (Skip for tie refunds, which return entry fees, not prize pool funds.)
  IF NOT _is_tie_refund AND _total_payout_cents > _pool.prize_pool_cents THEN
    RAISE EXCEPTION 'Payout exceeds prize pool: % > %', _total_payout_cents, _pool.prize_pool_cents;
  END IF;

  -- STEP 7: Finalize pool
  -- Tie-refund pools intentionally have empty winner_ids (matching scoring output);
  -- otherwise winner_ids is the set of users who received a positive payout,
  -- ordered deterministically by rank ASC, user_id ASC.
  UPDATE contest_pools
  SET status = 'settled',
      settled_at = now(),
      winner_ids = CASE
        WHEN _is_tie_refund THEN ARRAY[]::uuid[]
        ELSE COALESCE(
          (SELECT array_agg(user_id ORDER BY rank ASC, user_id ASC) FROM contest_scores WHERE pool_id = _pool_id AND payout_cents > 0),
          ARRAY[]::uuid[]
        )
      END
  WHERE id = _pool_id;

  -- STEP 8: Success
  RETURN QUERY SELECT
    true,
    'approved'::text,
    false,
    _pool_id,
    _total_payout_cents,
    _winners_count,
    _is_tie_refund;
END;
$$;


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
  -- Orphan-admin protection (CHANGE 1): JOIN auth.users so a stale user_roles
  -- row whose owning auth.users account was deleted cannot pass authorization.
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.user_id = _admin_user_id AND ur.role = 'admin'
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

  -- STEP 4.5 — Fail closed if any entries are settled (data integrity)
  -- A pool can have status='open' but settled entries from a partial-failure
  -- scenario. Voiding such a pool would abandon paid-out winnings.
  IF EXISTS (
    SELECT 1 FROM contest_entries
    WHERE pool_id = _pool_id AND status = 'settled'
  ) THEN
    RAISE EXCEPTION 'data integrity error: pool % has settled entries; cannot void', _pool_id;
  END IF;

  -- STEP 5 — Refund every active entry: insert transaction, credit wallet,
  -- write ledger entry, mark entry voided.
  FOR _rec IN
    SELECT id AS entry_id, user_id, entry_fee_cents
    FROM contest_entries
    WHERE pool_id = _pool_id AND status = 'active'
    ORDER BY user_id ASC
  LOOP
    -- Free-entry guard (CHANGE 3): only touch wallet/transaction/ledger when
    -- there is actually money to refund. Entry status update and accumulators
    -- still run so promotional ($0) pools void cleanly. refunded_count still
    -- increments since the entry was processed.
    IF _rec.entry_fee_cents > 0 THEN
      -- Resolve wallet for this user
      SELECT id INTO _wallet_id FROM wallets WHERE user_id = _rec.user_id;
      IF _wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found for user % during void refund', _rec.user_id;
      END IF;

      -- a. Insert refund transaction. Amount stored POSITIVE; direction is
      -- conveyed by type='refund'. This row is what compliance export reads.
      -- CHANGE 4: NULLIF guards against empty-string _reason producing
      -- 'Contest voided: ' with a trailing colon.
      INSERT INTO transactions (
        user_id, wallet_id, type, amount, status, description, reference_type, reference_id
      ) VALUES (
        _rec.user_id,
        _wallet_id,
        'refund',
        _rec.entry_fee_cents,
        'completed',
        COALESCE('Contest voided: ' || NULLIF(_reason, ''), 'Contest voided'),
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
    END IF;

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