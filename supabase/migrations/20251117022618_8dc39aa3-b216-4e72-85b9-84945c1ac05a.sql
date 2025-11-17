-- Restructure feature_flags table for key-value pattern
-- Drop existing table and recreate with new structure
DROP TABLE IF EXISTS public.feature_flags CASCADE;

CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public can read, only admins can write
CREATE POLICY "Anyone can view feature flags"
  ON public.feature_flags
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage feature flags"
  ON public.feature_flags
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial feature flags
INSERT INTO public.feature_flags (key, value) VALUES
  ('real_money_enabled', '{"enabled": false}'::jsonb),
  ('regulated_mode', '{"enabled": false}'::jsonb),
  ('ipbase_enabled', '{"enabled": true}'::jsonb),
  ('payments_provider', '{"name": "mock"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Add trigger to auto-update updated_at
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();