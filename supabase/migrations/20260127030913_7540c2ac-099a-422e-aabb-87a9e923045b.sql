-- Clone Contest Pool RPC Function
-- Used by Auto-Pooling to create a new pool when an existing one fills up

CREATE OR REPLACE FUNCTION public.clone_contest_pool(p_original_pool_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_original_pool RECORD;
  v_new_pool_id uuid;
  v_crew RECORD;
BEGIN
  -- Fetch the original pool
  SELECT * INTO v_original_pool
  FROM contest_pools
  WHERE id = p_original_pool_id;
  
  -- Validate original pool exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original pool not found: %', p_original_pool_id;
  END IF;
  
  -- Insert new pool with copied fields
  INSERT INTO contest_pools (
    contest_template_id,
    entry_fee_cents,
    max_entries,
    lock_time,
    prize_pool_cents,
    payout_structure,
    tier_id,
    allow_overflow,
    status,
    current_entries
  ) VALUES (
    v_original_pool.contest_template_id,
    v_original_pool.entry_fee_cents,
    v_original_pool.max_entries,
    v_original_pool.lock_time,
    v_original_pool.prize_pool_cents,
    v_original_pool.payout_structure,
    v_original_pool.tier_id,
    v_original_pool.allow_overflow,
    'open',
    0
  )
  RETURNING id INTO v_new_pool_id;
  
  -- Copy all crews from original pool to new pool
  FOR v_crew IN
    SELECT crew_id, crew_name, event_id
    FROM contest_pool_crews
    WHERE contest_pool_id = p_original_pool_id
  LOOP
    INSERT INTO contest_pool_crews (
      contest_pool_id,
      crew_id,
      crew_name,
      event_id
    ) VALUES (
      v_new_pool_id,
      v_crew.crew_id,
      v_crew.crew_name,
      v_crew.event_id
    );
  END LOOP;
  
  -- Return the new pool ID
  RETURN v_new_pool_id;
END;
$$;