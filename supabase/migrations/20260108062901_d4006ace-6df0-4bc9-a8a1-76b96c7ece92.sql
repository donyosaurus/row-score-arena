-- Create admin_create_contest function for atomic contest creation
CREATE OR REPLACE FUNCTION public.admin_create_contest(
  p_regatta_name text,
  p_entry_fee_cents bigint,
  p_max_entries int,
  p_lock_time timestamptz,
  p_crews jsonb
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
BEGIN
  -- Validate inputs
  IF p_regatta_name IS NULL OR p_regatta_name = '' THEN
    RAISE EXCEPTION 'Regatta name is required';
  END IF;
  
  IF p_entry_fee_cents < 0 THEN
    RAISE EXCEPTION 'Entry fee cannot be negative';
  END IF;
  
  IF p_max_entries < 2 THEN
    RAISE EXCEPTION 'Max entries must be at least 2';
  END IF;
  
  IF p_lock_time <= now() THEN
    RAISE EXCEPTION 'Lock time must be in the future';
  END IF;
  
  IF jsonb_array_length(p_crews) < 2 THEN
    RAISE EXCEPTION 'At least 2 crews are required';
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
    'open',
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
    tier_id
  ) VALUES (
    v_template_id,
    p_entry_fee_cents,
    p_max_entries,
    p_lock_time,
    'open',
    0,
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
    'crews_added', v_crew_count
  );
END;
$function$;