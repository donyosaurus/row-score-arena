
CREATE OR REPLACE FUNCTION public.clone_contest_pool(p_original_pool_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_original_pool RECORD;
  v_new_pool_id uuid;
BEGIN
  SELECT * INTO v_original_pool FROM contest_pools WHERE id = p_original_pool_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original pool not found: %', p_original_pool_id; END IF;

  INSERT INTO contest_pools (
    contest_template_id, entry_fee_cents, max_entries, lock_time, prize_pool_cents,
    payout_structure, tier_id, tier_name, allow_overflow, status, current_entries, entry_tiers
  ) VALUES (
    v_original_pool.contest_template_id, v_original_pool.entry_fee_cents, v_original_pool.max_entries,
    v_original_pool.lock_time, v_original_pool.prize_pool_cents, v_original_pool.payout_structure,
    v_original_pool.tier_id, v_original_pool.tier_name, v_original_pool.allow_overflow, 'open', 0, v_original_pool.entry_tiers
  )
  RETURNING id INTO v_new_pool_id;

  INSERT INTO contest_pool_crews (contest_pool_id, crew_id, crew_name, event_id, logo_url)
  SELECT v_new_pool_id, crew_id, crew_name, event_id, logo_url
  FROM contest_pool_crews WHERE contest_pool_id = p_original_pool_id;

  RETURN v_new_pool_id;
END;
$function$;
