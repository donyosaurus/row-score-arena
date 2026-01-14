-- Add payout_structure column to contest_pools (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contest_pools' 
    AND column_name = 'payout_structure'
  ) THEN
    ALTER TABLE public.contest_pools ADD COLUMN payout_structure JSONB DEFAULT NULL;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.contest_pools.payout_structure IS 'Fixed payout structure as JSON: {"1": 10000, "2": 5000} where keys are ranks and values are cents';

-- Replace admin_create_contest function with fixed payout support
CREATE OR REPLACE FUNCTION public.admin_create_contest(
  p_regatta_name TEXT,
  p_lock_time TIMESTAMPTZ,
  p_entry_fee_cents INTEGER,
  p_max_entries INTEGER,
  p_crews JSONB,
  p_gender_category TEXT DEFAULT 'open',
  p_payout_structure JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id UUID;
  v_pool_id UUID;
  v_tier_id UUID;
  v_guaranteed_prize_pool INTEGER := 0;
  v_payout_key TEXT;
  v_payout_value INTEGER;
BEGIN
  -- Calculate guaranteed prize pool from payout structure
  IF p_payout_structure IS NOT NULL THEN
    FOR v_payout_key, v_payout_value IN 
      SELECT key, value::INTEGER 
      FROM jsonb_each_text(p_payout_structure)
    LOOP
      v_guaranteed_prize_pool := v_guaranteed_prize_pool + v_payout_value;
    END LOOP;
  END IF;

  -- Create contest template
  INSERT INTO public.contest_templates (
    regatta_name,
    lock_time,
    crews,
    gender_category,
    status,
    min_picks,
    max_picks
  ) VALUES (
    p_regatta_name,
    p_lock_time,
    p_crews,
    p_gender_category,
    'open',
    1,
    COALESCE(jsonb_array_length(p_crews), 3)
  )
  RETURNING id INTO v_template_id;

  -- Generate tier ID
  v_tier_id := gen_random_uuid();

  -- Create contest pool with guaranteed prize pool from payout structure
  INSERT INTO public.contest_pools (
    contest_template_id,
    tier_id,
    entry_fee_cents,
    max_entries,
    prize_pool_cents,
    payout_structure,
    status,
    lock_time
  ) VALUES (
    v_template_id,
    v_tier_id,
    p_entry_fee_cents,
    p_max_entries,
    v_guaranteed_prize_pool,  -- Set to sum of fixed payouts
    p_payout_structure,
    'open',
    p_lock_time
  )
  RETURNING id INTO v_pool_id;

  RETURN jsonb_build_object(
    'success', true,
    'template_id', v_template_id,
    'pool_id', v_pool_id,
    'tier_id', v_tier_id,
    'guaranteed_prize_pool_cents', v_guaranteed_prize_pool
  );
END;
$$;