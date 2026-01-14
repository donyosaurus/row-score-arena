-- Redefine the function with the correct parameters (including gender_category)
CREATE OR REPLACE FUNCTION public.admin_create_contest(
  p_regatta_name text,
  p_gender_category text,
  p_entry_fee_cents bigint,
  p_max_entries int,
  p_lock_time timestamptz,
  p_crews jsonb,
  p_payout_structure jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_template_id uuid;
  v_pool_id uuid;
  v_crew jsonb;
  v_crew_count int := 0;
  v_guaranteed_prize_pool bigint := 0;
  v_rank text;
  v_amount bigint;
BEGIN
  -- Validate inputs
  IF p_regatta_name IS NULL OR p_regatta_name = '' THEN
    RAISE EXCEPTION 'Regatta name is required';
  END IF;
  
  -- Calculate Total Guaranteed Prize Pool from the structure
  IF p_payout_structure IS NOT NULL THEN
    FOR v_rank, v_amount IN SELECT * FROM jsonb_each_text(p_payout_structure)
    LOOP
      v_guaranteed_prize_pool := v_guaranteed_prize_pool + v_amount::bigint;
    END LOOP;
  END IF;

  -- Insert contest template
  INSERT INTO contest_templates (
    regatta_name,
    lock_time,
    gender_category,
    crews,
    status
  ) VALUES (
    p_regatta_name,
    p_lock_time,
    p_gender_category,
    p_crews,
    'open'
  )
  RETURNING id INTO v_template_id;

  -- Insert contest pool
  INSERT INTO contest_pools (
    contest_template_id,
    entry_fee_cents,
    max_entries,
    lock_time,
    status,
    prize_pool_cents,
    payout_structure,
    tier_id
  ) VALUES (
    v_template_id,
    p_entry_fee_cents,
    p_max_entries,
    p_lock_time,
    'open',
    v_guaranteed_prize_pool,
    p_payout_structure,
    'default'
  )
  RETURNING id INTO v_pool_id;

  -- Insert crew menu items
  FOR v_crew IN SELECT * FROM jsonb_array_elements(p_crews)
  LOOP
    INSERT INTO contest_pool_crews (
      contest_pool_id,
      crew_name,
      crew_id,
      event_id
    ) VALUES (
      v_pool_id,
      v_crew->>'crew_name',
      v_crew->>'crew_id',
      v_crew->>'event_id'
    );
    v_crew_count := v_crew_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'contest_template_id', v_template_id,
    'contest_pool_id', v_pool_id,
    'crews_added', v_crew_count,
    'guaranteed_pool', v_guaranteed_prize_pool
  );
END;
$function$;