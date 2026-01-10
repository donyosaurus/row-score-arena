-- Update the admin_create_contest function to accept gender_category parameter
CREATE OR REPLACE FUNCTION public.admin_create_contest(
  p_regatta_name text,
  p_entry_fee_cents integer,
  p_max_entries integer,
  p_lock_time timestamptz,
  p_crews jsonb,
  p_gender_category text DEFAULT 'Men''s'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest_template_id uuid;
  v_contest_pool_id uuid;
  v_tier_id uuid;
  v_crew jsonb;
  v_crews_added integer := 0;
BEGIN
  -- Create contest template with gender_category
  INSERT INTO contest_templates (
    regatta_name,
    lock_time,
    gender_category,
    status,
    crews,
    divisions,
    entry_tiers,
    min_picks,
    max_picks
  ) VALUES (
    p_regatta_name,
    p_lock_time,
    p_gender_category,
    'open',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    1,
    10
  )
  RETURNING id INTO v_contest_template_id;

  -- Generate a tier_id for the pool
  v_tier_id := gen_random_uuid();

  -- Create contest pool
  INSERT INTO contest_pools (
    contest_template_id,
    tier_id,
    entry_fee_cents,
    max_entries,
    lock_time,
    prize_pool_cents,
    status
  ) VALUES (
    v_contest_template_id,
    v_tier_id,
    p_entry_fee_cents,
    p_max_entries,
    p_lock_time,
    0,
    'open'
  )
  RETURNING id INTO v_contest_pool_id;

  -- Add crews to the pool
  FOR v_crew IN SELECT * FROM jsonb_array_elements(p_crews)
  LOOP
    INSERT INTO contest_pool_crews (
      contest_pool_id,
      crew_id,
      crew_name,
      event_id
    ) VALUES (
      v_contest_pool_id,
      v_crew->>'crew_id',
      v_crew->>'crew_name',
      v_crew->>'event_id'
    );
    v_crews_added := v_crews_added + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'contest_template_id', v_contest_template_id,
    'contest_pool_id', v_contest_pool_id,
    'crews_added', v_crews_added
  );
END;
$$;