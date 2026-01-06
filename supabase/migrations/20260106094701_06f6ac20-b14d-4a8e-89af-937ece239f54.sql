-- Create PL/pgSQL function for admin to update race results atomically
CREATE OR REPLACE FUNCTION public.admin_update_race_results(
  p_contest_pool_id uuid,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_crew_id text;
  v_finish_order int;
  v_finish_time text;
  v_pool_exists boolean;
BEGIN
  -- Verify the contest pool exists
  SELECT EXISTS (
    SELECT 1 FROM contest_pools WHERE id = p_contest_pool_id
  ) INTO v_pool_exists;
  
  IF NOT v_pool_exists THEN
    RAISE EXCEPTION 'Contest pool not found';
  END IF;
  
  -- Iterate through each result and update contest_pool_crews
  FOR v_result IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    v_crew_id := v_result->>'crew_id';
    v_finish_order := (v_result->>'finish_order')::int;
    v_finish_time := v_result->>'finish_time';
    
    -- Update the crew's result in contest_pool_crews
    UPDATE contest_pool_crews
    SET 
      manual_finish_order = v_finish_order,
      manual_result_time = v_finish_time
    WHERE contest_pool_id = p_contest_pool_id 
      AND crew_id = v_crew_id;
    
    -- Check if the update affected any rows
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Crew % not found in contest pool', v_crew_id;
    END IF;
  END LOOP;
  
  -- Update contest pool status to trigger scoring
  UPDATE contest_pools
  SET status = 'scoring_processing'
  WHERE id = p_contest_pool_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute permission to service_role only (admin operations)
REVOKE ALL ON FUNCTION public.admin_update_race_results(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_race_results(uuid, jsonb) TO service_role;