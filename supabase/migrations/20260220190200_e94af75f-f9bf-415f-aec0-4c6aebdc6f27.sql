ALTER TABLE public.contest_scores 
  DROP CONSTRAINT IF EXISTS contest_scores_instance_id_fkey;

ALTER TABLE public.contest_scores
  ADD COLUMN IF NOT EXISTS pool_id uuid REFERENCES public.contest_pools(id) ON DELETE CASCADE;

ALTER TABLE public.contest_scores
  ALTER COLUMN instance_id DROP NOT NULL;