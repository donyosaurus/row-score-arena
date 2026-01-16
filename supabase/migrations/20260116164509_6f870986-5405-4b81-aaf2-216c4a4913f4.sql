-- Fix contest pool visibility for Lobby page
-- Drop the restrictive policy that only shows pools users have entered
DROP POLICY IF EXISTS "Users can view pools they entered" ON public.contest_pools;

-- Create a permissive policy allowing all authenticated users to view pools
CREATE POLICY "Anyone can view contest pools"
ON public.contest_pools
FOR SELECT
TO authenticated
USING (true);