-- Add payment_sessions table
CREATE TABLE public.payment_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'mock' | 'highrisk' | 'ach'
  provider_session_id text,
  amount_cents bigint NOT NULL,
  state_code text,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'succeeded' | 'failed' | 'expired'
  checkout_url text,
  client_token text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Add idempotency_key to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;

-- Add new transaction types (extend existing enum)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM (
      'deposit',
      'withdrawal', 
      'entry_fee_hold',
      'entry_fee_release',
      'payout',
      'refund',
      'provider_fee',
      'platform_fee',
      'tax',
      'bonus'
    );
  ELSE
    -- Add new values if they don't exist
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'entry_fee_hold';
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'entry_fee_release';
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'provider_fee';
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'platform_fee';
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'tax';
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bonus';
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_sessions_user_id ON public.payment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_provider_session_id ON public.payment_sessions(provider_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON public.payment_sessions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_key ON public.transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions(reference_id, reference_type);

-- Enable RLS on payment_sessions
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_sessions
CREATE POLICY "Users can view their own payment sessions"
ON public.payment_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert payment sessions"
ON public.payment_sessions FOR INSERT
WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can update payment sessions"
ON public.payment_sessions FOR UPDATE
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all payment sessions"
ON public.payment_sessions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at on payment_sessions
CREATE TRIGGER update_payment_sessions_updated_at
BEFORE UPDATE ON public.payment_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();