-- Contest Templates (regattas/events that users can enter)
CREATE TABLE public.contest_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regatta_name TEXT NOT NULL,
  gender_category TEXT NOT NULL CHECK (gender_category IN ('Men''s', 'Women''s')),
  lock_time TIMESTAMP WITH TIME ZONE NOT NULL,
  min_picks INTEGER NOT NULL DEFAULT 2,
  max_picks INTEGER NOT NULL DEFAULT 4,
  divisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  crews JSONB NOT NULL DEFAULT '[]'::jsonb,
  entry_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'settled', 'voided')),
  results JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contest Pools (instances of contests that users are matched into)
CREATE TABLE public.contest_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_template_id UUID NOT NULL REFERENCES public.contest_templates(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL,
  entry_fee_cents BIGINT NOT NULL,
  prize_pool_cents BIGINT NOT NULL,
  max_entries INTEGER NOT NULL,
  current_entries INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'settling', 'settled', 'voided')),
  lock_time TIMESTAMP WITH TIME ZONE NOT NULL,
  winner_ids UUID[],
  prize_structure JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settled_at TIMESTAMP WITH TIME ZONE
);

-- Contest Entries (user participation in a specific pool)
CREATE TABLE public.contest_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES public.contest_pools(id) ON DELETE CASCADE,
  contest_template_id UUID NOT NULL REFERENCES public.contest_templates(id) ON DELETE CASCADE,
  picks JSONB NOT NULL,
  total_points INTEGER DEFAULT 0,
  margin_error NUMERIC DEFAULT 0,
  rank INTEGER,
  state_code TEXT,
  entry_fee_cents BIGINT NOT NULL,
  payout_cents BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'settled', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, pool_id)
);

-- Match Queue (temporary holding for users being matched into pools)
CREATE TABLE public.match_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contest_template_id UUID NOT NULL REFERENCES public.contest_templates(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL,
  entry_fee_cents BIGINT NOT NULL,
  state_code TEXT NOT NULL,
  picks JSONB NOT NULL,
  pool_id UUID REFERENCES public.contest_pools(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'cancelled')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  matched_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.contest_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contest_templates
CREATE POLICY "Anyone can view open contest templates"
  ON public.contest_templates FOR SELECT
  USING (status = 'open' OR status = 'locked');

CREATE POLICY "Admins can manage contest templates"
  ON public.contest_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for contest_pools
CREATE POLICY "Users can view pools they entered"
  ON public.contest_pools FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contest_entries
      WHERE contest_entries.pool_id = contest_pools.id
        AND contest_entries.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage pools"
  ON public.contest_pools FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for contest_entries
CREATE POLICY "Users can view their own entries"
  ON public.contest_entries FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own entries"
  ON public.contest_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update entries"
  ON public.contest_entries FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage entries"
  ON public.contest_entries FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for match_queue
CREATE POLICY "Users can view their own queue entries"
  ON public.match_queue FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert into queue"
  ON public.match_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update queue"
  ON public.match_queue FOR UPDATE
  USING (true);

CREATE POLICY "Admins can manage queue"
  ON public.match_queue FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Add new transaction types for contest operations
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'entry_fee_hold', 'entry_fee_release', 'payout', 'refund', 'platform_fee');
  ELSE
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'entry_fee_hold';
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'entry_fee_release';
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'payout';
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'refund';
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'platform_fee';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX idx_contest_pools_template_status ON public.contest_pools(contest_template_id, status);
CREATE INDEX idx_contest_pools_lock_time ON public.contest_pools(lock_time) WHERE status = 'open';
CREATE INDEX idx_contest_entries_user ON public.contest_entries(user_id);
CREATE INDEX idx_contest_entries_pool ON public.contest_entries(pool_id);
CREATE INDEX idx_match_queue_status ON public.match_queue(status, joined_at) WHERE status = 'pending';

-- Create trigger for updated_at
CREATE TRIGGER update_contest_templates_updated_at
  BEFORE UPDATE ON public.contest_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contest_entries_updated_at
  BEFORE UPDATE ON public.contest_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();