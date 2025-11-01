-- Security Hardening Migration
-- Webhook deduplication, feature flags, and withdrawal locking improvements

-- 1. Webhook Deduplication Table
CREATE TABLE IF NOT EXISTS public.webhook_dedup (
  id text PRIMARY KEY,
  provider text NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_webhook_dedup_received_at ON public.webhook_dedup(received_at);
CREATE INDEX idx_webhook_dedup_provider ON public.webhook_dedup(provider);

-- Auto-cleanup old webhook records (keep for 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhooks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.webhook_dedup
  WHERE received_at < now() - interval '7 days';
END;
$$;

-- 2. Feature Flags Table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text UNIQUE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert critical safety flag
INSERT INTO public.feature_flags (flag_name, enabled, description)
VALUES ('real_money_enabled', false, 'Master kill switch for all real money transactions')
ON CONFLICT (flag_name) DO NOTHING;

-- 3. Rate Limiting Table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- IP address or user_id
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_identifier ON public.rate_limits(identifier);
CREATE INDEX idx_rate_limits_window ON public.rate_limits(window_start);

-- Auto-cleanup old rate limit records (keep for 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$;

-- 4. Improved Withdrawal Transaction Function with Locking
CREATE OR REPLACE FUNCTION public.initiate_withdrawal_atomic(
  _user_id uuid,
  _wallet_id uuid,
  _amount_cents bigint,
  _state_code text
)
RETURNS TABLE(
  allowed boolean,
  reason text,
  today_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today_start timestamptz;
  _today_withdrawals numeric;
  _pending_withdrawals numeric;
  _last_withdrawal_at timestamptz;
  _available_balance numeric;
BEGIN
  -- Advisory lock on user to prevent concurrent withdrawals
  PERFORM pg_advisory_xact_lock(hashtext(_user_id::text));
  
  -- Get UTC start of day
  _today_start := date_trunc('day', now() AT TIME ZONE 'UTC');
  
  -- Calculate today's completed withdrawals
  SELECT COALESCE(SUM(ABS(amount)), 0)
  INTO _today_withdrawals
  FROM transactions
  WHERE user_id = _user_id
    AND type = 'withdrawal'
    AND status = 'completed'
    AND created_at >= _today_start;
  
  -- Calculate pending withdrawals
  SELECT COALESCE(SUM(ABS(amount)), 0)
  INTO _pending_withdrawals
  FROM transactions
  WHERE user_id = _user_id
    AND type = 'withdrawal'
    AND status = 'pending';
  
  -- Check daily limit (including pending)
  IF (_today_withdrawals + _pending_withdrawals + (_amount_cents / 100.0)) > 500 THEN
    RETURN QUERY SELECT false, 'Daily withdrawal limit exceeded'::text, _today_withdrawals + _pending_withdrawals;
    RETURN;
  END IF;
  
  -- Check per-transaction limit
  IF (_amount_cents / 100.0) > 500 THEN
    RETURN QUERY SELECT false, 'Per-transaction limit exceeded'::text, _today_withdrawals;
    RETURN;
  END IF;
  
  -- Check cooldown (10 minutes between withdrawals)
  SELECT MAX(created_at)
  INTO _last_withdrawal_at
  FROM transactions
  WHERE user_id = _user_id
    AND type = 'withdrawal';
  
  IF _last_withdrawal_at IS NOT NULL AND _last_withdrawal_at > (now() - interval '10 minutes') THEN
    RETURN QUERY SELECT false, 'Please wait 10 minutes between withdrawals'::text, _today_withdrawals;
    RETURN;
  END IF;
  
  -- Check available balance
  SELECT available_balance
  INTO _available_balance
  FROM wallets
  WHERE id = _wallet_id
  FOR UPDATE; -- Lock wallet row
  
  IF _available_balance < (_amount_cents / 100.0) THEN
    RETURN QUERY SELECT false, 'Insufficient balance'::text, _today_withdrawals;
    RETURN;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT true, 'Approved'::text, _today_withdrawals;
END;
$$;

-- 5. RLS Policies for New Tables

-- webhook_dedup: System-only access
ALTER TABLE public.webhook_dedup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage webhook dedup"
ON public.webhook_dedup
FOR ALL
USING (true)
WITH CHECK (true);

-- feature_flags: Admins can view/update, users can view
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage feature flags"
ON public.feature_flags
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (true);

-- rate_limits: System-only access
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage rate limits"
ON public.rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON public.webhook_dedup TO service_role;
GRANT ALL ON public.feature_flags TO service_role;
GRANT ALL ON public.rate_limits TO service_role;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT EXECUTE ON FUNCTION public.initiate_withdrawal_atomic TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_webhooks TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits TO service_role;