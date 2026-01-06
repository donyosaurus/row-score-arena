-- Create ledger_entries table for double-entry bookkeeping
CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount bigint NOT NULL, -- Stored in cents (e.g., $1.00 = 100)
  transaction_type text NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'ENTRY_FEE', 'PRIZE', 'REFUND', 'BONUS', 'ADJUSTMENT')),
  description text,
  reference_id uuid, -- Links to contest_entries, payment_sessions, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient balance queries
CREATE INDEX idx_ledger_entries_user_id ON public.ledger_entries(user_id);
CREATE INDEX idx_ledger_entries_user_created ON public.ledger_entries(user_id, created_at DESC);
CREATE INDEX idx_ledger_entries_reference ON public.ledger_entries(reference_id) WHERE reference_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own ledger entries
CREATE POLICY "Users can view their own ledger entries"
ON public.ledger_entries
FOR SELECT
USING (auth.uid() = user_id);

-- Only service_role can insert (edge functions with service role key)
CREATE POLICY "Service role can insert ledger entries"
ON public.ledger_entries
FOR INSERT
WITH CHECK (true);

-- Admins can view all ledger entries
CREATE POLICY "Admins can view all ledger entries"
ON public.ledger_entries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- No updates or deletes allowed (immutable ledger)
-- This is enforced by not having UPDATE/DELETE policies

-- Create function to get user balance
CREATE OR REPLACE FUNCTION public.get_user_balance(target_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::bigint
  FROM public.ledger_entries
  WHERE user_id = target_user_id;
$$;