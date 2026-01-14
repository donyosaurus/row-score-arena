-- Add payout_structure column to contest_pools
ALTER TABLE public.contest_pools 
ADD COLUMN IF NOT EXISTS payout_structure jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.contest_pools.payout_structure IS 'Fixed payout structure by rank: {"1": 10000, "2": 5000, "3": 2500} in cents';

-- Drop existing RPC function versions to recreate with new parameter
DROP FUNCTION IF EXISTS public.admin_create_contest(jsonb, integer, text, integer, text);
DROP FUNCTION IF EXISTS public.admin_create_contest(jsonb, integer, varchar, text, integer, text);

-- Recreate the admin_create_contest function with payout_structure support
-- Parameters without defaults first, then those with defaults
CREATE OR REPLACE FUNCTION public.admin_create_contest(
  p_crews jsonb,
  p_entry_fee_cents integer,
  p_lock_time text,
  p_max_entries integer,
  p_regatta_name text,
  p_gender_category varchar DEFAULT 'Men''s',
  p_payout_structure jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
  v_pool_id uuid;
  v_tier_id uuid := gen_random_uuid();
  v_crew_record jsonb;
  v_crews_added integer := 0;
  v_total_payout_cents integer := 0;
BEGIN
  -- Calculate total payout from structure (if provided)
  IF p_payout_structure IS NOT NULL THEN
    SELECT COALESCE(SUM((value)::integer), 0) INTO v_total_payout_cents
    FROM jsonb_each_text(p_payout_structure);
  END IF;

  -- Create contest template
  INSERT INTO public.contest_templates (
    regatta_name,
    gender_category,
    lock_time,
    min_picks,
    max_picks,
    status,
    crews,
    divisions,
    entry_tiers
  ) VALUES (
    p_regatta_name,
    p_gender_category,
    p_lock_time::timestamp with time zone,
    1,
    5,
    'open',
    p_crews,
    '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'id', v_tier_id,
        'name', 'Standard',
        'entry_fee_cents', p_entry_fee_cents,
        'max_entries', p_max_entries
      )
    )
  )
  RETURNING id INTO v_template_id;

  -- Create contest pool with prize_pool_cents = sum of payouts (guaranteed liability)
  INSERT INTO public.contest_pools (
    contest_template_id,
    tier_id,
    entry_fee_cents,
    max_entries,
    prize_pool_cents,
    lock_time,
    status,
    current_entries,
    payout_structure
  ) VALUES (
    v_template_id,
    v_tier_id::text,
    p_entry_fee_cents,
    p_max_entries,
    v_total_payout_cents, -- Sum of fixed payouts
    p_lock_time::timestamp with time zone,
    'open',
    0,
    p_payout_structure
  )
  RETURNING id INTO v_pool_id;

  -- Insert crews into contest_pool_crews
  FOR v_crew_record IN SELECT * FROM jsonb_array_elements(p_crews)
  LOOP
    INSERT INTO public.contest_pool_crews (
      contest_pool_id,
      crew_id,
      crew_name,
      event_id
    ) VALUES (
      v_pool_id,
      v_crew_record->>'crew_id',
      v_crew_record->>'crew_name',
      v_crew_record->>'event_id'
    );
    v_crews_added := v_crews_added + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'contest_template_id', v_template_id,
    'contest_pool_id', v_pool_id,
    'tier_id', v_tier_id,
    'crews_added', v_crews_added,
    'total_payout_cents', v_total_payout_cents
  );
END;
$$;