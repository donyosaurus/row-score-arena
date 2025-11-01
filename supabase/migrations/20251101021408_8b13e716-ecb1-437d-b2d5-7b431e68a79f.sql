-- Phase 5: Contest Matchmaking, Scoring, and Settlement Tables

-- Contest Instances Table - Multiple pools for same contest template
CREATE TABLE IF NOT EXISTS public.contest_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_template_id uuid NOT NULL REFERENCES public.contest_templates(id) ON DELETE CASCADE,
  pool_number text NOT NULL, -- e.g., "A", "B", "C"
  tier_id text NOT NULL,
  entry_fee_cents bigint NOT NULL,
  prize_pool_cents bigint NOT NULL DEFAULT 0,
  max_entries integer NOT NULL,
  current_entries integer NOT NULL DEFAULT 0,
  min_entries integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'open', -- open, locked, completed, cancelled
  lock_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  completed_at timestamptz,
  settled_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(contest_template_id, tier_id, pool_number)
);

-- Contest Scores Table - Scoring results for each entry
CREATE TABLE IF NOT EXISTS public.contest_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.contest_entries(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.contest_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  total_points integer NOT NULL DEFAULT 0,
  margin_bonus numeric(10, 2) NOT NULL DEFAULT 0,
  rank integer,
  payout_cents bigint DEFAULT 0,
  is_winner boolean DEFAULT false,
  is_tiebreak_resolved boolean DEFAULT false,
  crew_scores jsonb DEFAULT '[]'::jsonb, -- Array of {crew_id, event, finish_pos, finish_points, margin_error, margin_bonus}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entry_id)
);

-- Race Results Imports Table - Track admin CSV uploads
CREATE TABLE IF NOT EXISTS public.race_results_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_template_id uuid NOT NULL REFERENCES public.contest_templates(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  regatta_name text NOT NULL,
  import_date timestamptz NOT NULL DEFAULT now(),
  results_data jsonb NOT NULL, -- Full CSV data as JSON
  rows_processed integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending, completed, failed
  file_hash text, -- SHA256 hash of CSV for deduplication
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contest_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_results_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contest_instances
CREATE POLICY "Anyone can view open/locked contest instances"
  ON public.contest_instances FOR SELECT
  USING (status IN ('open', 'locked', 'completed'));

CREATE POLICY "Admins can manage contest instances"
  ON public.contest_instances FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for contest_scores
CREATE POLICY "Users can view their own scores"
  ON public.contest_scores FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view scores in completed contests"
  ON public.contest_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contest_instances
      WHERE id = contest_scores.instance_id
      AND status = 'completed'
    )
  );

CREATE POLICY "Admins can manage scores"
  ON public.contest_scores FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for race_results_imports
CREATE POLICY "Admins can view all imports"
  ON public.race_results_imports FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create imports"
  ON public.race_results_imports FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_contest_instances_template_status 
  ON public.contest_instances(contest_template_id, status);

CREATE INDEX idx_contest_instances_lock_time 
  ON public.contest_instances(lock_time) WHERE status = 'open';

CREATE INDEX idx_contest_scores_instance_rank 
  ON public.contest_scores(instance_id, rank);

CREATE INDEX idx_contest_scores_user 
  ON public.contest_scores(user_id);

CREATE INDEX idx_race_results_template 
  ON public.race_results_imports(contest_template_id, import_date DESC);

-- Update contest_entries to link to instances
ALTER TABLE public.contest_entries
  ADD COLUMN IF NOT EXISTS instance_id uuid REFERENCES public.contest_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contest_entries_instance 
  ON public.contest_entries(instance_id);

-- Trigger to update contest_scores updated_at
CREATE TRIGGER update_contest_scores_updated_at
  BEFORE UPDATE ON public.contest_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.contest_instances IS 'Multiple pool instances for each contest template with capacity management';
COMMENT ON TABLE public.contest_scores IS 'Calculated scores and rankings for each contest entry';
COMMENT ON TABLE public.race_results_imports IS 'Audit trail for race result CSV imports by admins';
COMMENT ON COLUMN public.contest_scores.total_points IS 'Sum of finish order points across all crew picks';
COMMENT ON COLUMN public.contest_scores.margin_bonus IS 'Tie-breaker bonus based on margin prediction accuracy';
COMMENT ON COLUMN public.contest_scores.crew_scores IS 'Detailed breakdown of points per crew selection';