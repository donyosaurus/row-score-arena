-- Create responsible_gaming table
CREATE TABLE public.responsible_gaming (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  deposit_limit_monthly_cents BIGINT,
  self_exclusion_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.responsible_gaming ENABLE ROW LEVEL SECURITY;

-- RLS: Users can SELECT their own row
CREATE POLICY "Users can view their own responsible gaming settings"
ON public.responsible_gaming
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Users can UPDATE their own row
CREATE POLICY "Users can update their own responsible gaming settings"
ON public.responsible_gaming
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS: Users can INSERT their own row
CREATE POLICY "Users can insert their own responsible gaming settings"
ON public.responsible_gaming
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_responsible_gaming_updated_at
BEFORE UPDATE ON public.responsible_gaming
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RPC Function: check_deposit_limit
CREATE OR REPLACE FUNCTION public.check_deposit_limit(p_user_id UUID, p_amount BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_settings RECORD;
  v_monthly_deposits BIGINT;
BEGIN
  -- Get responsible gaming settings
  SELECT * INTO v_settings
  FROM responsible_gaming
  WHERE user_id = p_user_id;
  
  -- If no settings exist, allow the deposit
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  -- Check self-exclusion
  IF v_settings.self_exclusion_until IS NOT NULL AND v_settings.self_exclusion_until > now() THEN
    RAISE EXCEPTION 'Account is self-excluded until %', v_settings.self_exclusion_until::date;
  END IF;
  
  -- Check deposit limit if set
  IF v_settings.deposit_limit_monthly_cents IS NOT NULL THEN
    -- Sum deposits from last 30 days
    SELECT COALESCE(SUM(amount), 0) INTO v_monthly_deposits
    FROM ledger_entries
    WHERE user_id = p_user_id
      AND transaction_type = 'DEPOSIT'
      AND created_at >= now() - interval '30 days';
    
    -- Check if new deposit would exceed limit
    IF (v_monthly_deposits + p_amount) > v_settings.deposit_limit_monthly_cents THEN
      RAISE EXCEPTION 'Deposit exceeds monthly limit. Current: $%, Limit: $%, Requested: $%',
        (v_monthly_deposits / 100.0)::numeric(10,2),
        (v_settings.deposit_limit_monthly_cents / 100.0)::numeric(10,2),
        (p_amount / 100.0)::numeric(10,2);
    END IF;
  END IF;
  
  RETURN true;
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.check_deposit_limit(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_deposit_limit(UUID, BIGINT) TO service_role;