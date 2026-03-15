-- Fix 1: user_in_pool must include 'voided' entries
CREATE OR REPLACE FUNCTION public.user_in_pool(_user_id uuid, _pool_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contest_entries
    WHERE user_id = _user_id AND pool_id = _pool_id
      AND status IN ('active', 'scored', 'settled', 'voided')
  )
$$;

-- Fix 2: contest_scores RLS — switch from deprecated instance_id to pool_id
DROP POLICY IF EXISTS "Users can view scores in completed contests" ON public.contest_scores;
CREATE POLICY "Users can view scores in shared pools"
  ON public.contest_scores FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (pool_id IS NOT NULL AND public.user_in_pool(auth.uid(), pool_id))
  );

-- Fix 3: Security definer function for username lookups
CREATE OR REPLACE FUNCTION public.get_usernames(user_ids uuid[])
RETURNS TABLE(user_id uuid, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, username FROM public.profiles WHERE id = ANY(user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_usernames(uuid[]) TO authenticated;