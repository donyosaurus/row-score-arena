-- Create the contest_pool_crews table for admin-curated crew lists
CREATE TABLE public.contest_pool_crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_pool_id uuid NOT NULL REFERENCES public.contest_pools(id) ON DELETE CASCADE,
  crew_id text NOT NULL,
  event_id text NOT NULL,
  crew_name text NOT NULL,
  manual_result_time text,
  manual_finish_order integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Ensure unique crew per pool
  UNIQUE(contest_pool_id, crew_id)
);

-- Create index for faster lookups
CREATE INDEX idx_contest_pool_crews_pool_id ON public.contest_pool_crews(contest_pool_id);

-- Enable Row Level Security
ALTER TABLE public.contest_pool_crews ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view crews (to see the drafting menu)
CREATE POLICY "Authenticated users can view contest crews"
ON public.contest_pool_crews
FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage crews
CREATE POLICY "Admins can manage contest crews"
ON public.contest_pool_crews
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));