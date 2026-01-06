-- Create PL/pgSQL function for calculating pool scores atomically
CREATE OR REPLACE FUNCTION public.calculate_pool_scores(
  p_contest_pool_id uuid,
  p_official_margin_seconds numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crew record;
  v_entry record;
  v_crew_points jsonb := '{}';
  v_points int;
  v_entry_score int;
  v_tiebreaker_penalty numeric;
  v_user_margin numeric;
  v_entries_processed int := 0;
BEGIN
  -- Build crew_id -> points mapping based on finish order
  -- Rule: 1st=100pts, 2nd=80pts, 3rd=60pts, 4th=40pts, 5th=20pts, 6th+=0pts
  FOR v_crew IN 
    SELECT crew_id, manual_finish_order 
    FROM contest_pool_crews 
    WHERE contest_pool_id = p_contest_pool_id
      AND manual_finish_order IS NOT NULL
  LOOP
    CASE v_crew.manual_finish_order
      WHEN 1 THEN v_points := 100;
      WHEN 2 THEN v_points := 80;
      WHEN 3 THEN v_points := 60;
      WHEN 4 THEN v_points := 40;
      WHEN 5 THEN v_points := 20;
      ELSE v_points := 0;
    END CASE;
    
    v_crew_points := v_crew_points || jsonb_build_object(v_crew.crew_id, v_points);
  END LOOP;
  
  -- Score each entry in this pool
  FOR v_entry IN 
    SELECT id, picks 
    FROM contest_entries 
    WHERE pool_id = p_contest_pool_id
      AND status = 'active'
  LOOP
    -- Calculate score: sum of points for all crews in picks
    v_entry_score := 0;
    
    -- picks.crews is an array of crew_ids
    SELECT COALESCE(SUM((v_crew_points->>crew_id)::int), 0)
    INTO v_entry_score
    FROM jsonb_array_elements_text(v_entry.picks->'crews') AS crew_id
    WHERE v_crew_points ? crew_id;
    
    -- Calculate tiebreaker penalty: ABS(user_margin - official_margin)
    v_user_margin := (v_entry.picks->>'tiebreaker_margin')::numeric;
    v_tiebreaker_penalty := ABS(COALESCE(v_user_margin, 0) - COALESCE(p_official_margin_seconds, 0));
    
    -- Update the entry with calculated values
    UPDATE contest_entries
    SET 
      total_points = v_entry_score,
      margin_error = v_tiebreaker_penalty,
      updated_at = now()
    WHERE id = v_entry.id;
    
    v_entries_processed := v_entries_processed + 1;
  END LOOP;
  
  -- Assign ranks based on score (desc) then tiebreaker penalty (asc)
  UPDATE contest_entries ce
  SET rank = ranked.rank
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY total_points DESC, margin_error ASC
      ) AS rank
    FROM contest_entries
    WHERE pool_id = p_contest_pool_id
      AND status = 'active'
  ) ranked
  WHERE ce.id = ranked.id;
  
  -- Update pool status to scoring_completed
  UPDATE contest_pools
  SET status = 'scoring_completed'
  WHERE id = p_contest_pool_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'entries_processed', v_entries_processed
  );
END;
$$;

-- Grant execute permission to service_role only
REVOKE ALL ON FUNCTION public.calculate_pool_scores(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_pool_scores(uuid, numeric) TO service_role;