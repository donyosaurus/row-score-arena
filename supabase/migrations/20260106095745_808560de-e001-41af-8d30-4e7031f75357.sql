-- Create PL/pgSQL function for settling pool payouts atomically
CREATE OR REPLACE FUNCTION public.settle_pool_payouts(
  p_contest_pool_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool record;
  v_gross_pot bigint;
  v_platform_fee bigint;
  v_net_prize bigint;
  v_winner record;
  v_winner_count int;
  v_payout_per_winner bigint;
  v_total_payout bigint := 0;
  v_winner_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Lock the pool row to prevent concurrent settlements
  SELECT * INTO v_pool
  FROM contest_pools
  WHERE id = p_contest_pool_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest pool not found';
  END IF;
  
  -- Ensure pool is in scoring_completed status
  IF v_pool.status != 'scoring_completed' THEN
    RAISE EXCEPTION 'Pool must be in scoring_completed status to settle. Current status: %', v_pool.status;
  END IF;
  
  -- Calculate pot and fees
  v_gross_pot := v_pool.current_entries * v_pool.entry_fee_cents;
  v_platform_fee := (v_gross_pot * 10) / 100;  -- 10% rake
  v_net_prize := v_gross_pot - v_platform_fee;
  
  -- Count winners (rank = 1)
  SELECT COUNT(*) INTO v_winner_count
  FROM contest_entries
  WHERE pool_id = p_contest_pool_id
    AND rank = 1
    AND status = 'active';
  
  IF v_winner_count = 0 THEN
    RAISE EXCEPTION 'No winners found for this pool';
  END IF;
  
  -- Calculate payout per winner (handles ties)
  v_payout_per_winner := v_net_prize / v_winner_count;
  
  -- Process each winner
  FOR v_winner IN 
    SELECT ce.id, ce.user_id
    FROM contest_entries ce
    WHERE ce.pool_id = p_contest_pool_id
      AND ce.rank = 1
      AND ce.status = 'active'
  LOOP
    -- Add to winner_ids array
    v_winner_ids := array_append(v_winner_ids, v_winner.user_id);
    
    -- Insert payout into ledger_entries
    INSERT INTO ledger_entries (
      user_id,
      amount,
      transaction_type,
      description,
      reference_id
    ) VALUES (
      v_winner.user_id,
      v_payout_per_winner,
      'PRIZE_PAYOUT',
      'Contest Payout: Pool ' || p_contest_pool_id::text,
      p_contest_pool_id
    );
    
    -- Update entry with payout amount and settled status
    UPDATE contest_entries
    SET 
      payout_cents = v_payout_per_winner,
      status = 'settled',
      updated_at = now()
    WHERE id = v_winner.id;
    
    v_total_payout := v_total_payout + v_payout_per_winner;
  END LOOP;
  
  -- Update non-winners to settled status (no payout)
  UPDATE contest_entries
  SET 
    status = 'settled',
    payout_cents = 0,
    updated_at = now()
  WHERE pool_id = p_contest_pool_id
    AND status = 'active'
    AND rank != 1;
  
  -- Finalize pool status
  UPDATE contest_pools
  SET 
    status = 'settled',
    settled_at = now(),
    winner_ids = v_winner_ids
  WHERE id = p_contest_pool_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'winners_count', v_winner_count,
    'total_payout', v_total_payout,
    'gross_pot', v_gross_pot,
    'platform_fee', v_platform_fee,
    'payout_per_winner', v_payout_per_winner
  );
END;
$$;

-- Grant execute permission to service_role only
REVOKE ALL ON FUNCTION public.settle_pool_payouts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_pool_payouts(uuid) TO service_role;