-- Phase 1: State Regulation Rules & License Tracking

-- Create state regulation rules table
CREATE TABLE public.state_regulation_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_code text NOT NULL UNIQUE,
  state_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('permitted', 'regulated', 'restricted', 'banned')),
  license_required boolean NOT NULL DEFAULT false,
  min_age integer NOT NULL DEFAULT 18,
  head_to_head_allowed boolean NOT NULL DEFAULT true,
  pickem_allowed boolean NOT NULL DEFAULT true,
  parlay_allowed boolean NOT NULL DEFAULT true,
  min_contestants integer NOT NULL DEFAULT 2,
  requires_skill_predominance boolean NOT NULL DEFAULT true,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0.00,
  notes text,
  last_verified_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create license registry table
CREATE TABLE public.license_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_code text NOT NULL REFERENCES public.state_regulation_rules(state_code),
  license_number text,
  license_type text NOT NULL DEFAULT 'registration',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'expired', 'suspended')),
  issued_date date,
  expiry_date date,
  renewal_link text,
  filing_fee numeric(10,2),
  report_due_date date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(state_code, license_type)
);

-- Add player protection fields to profiles
ALTER TABLE public.profiles
ADD COLUMN deposit_limit_monthly numeric(10,2) DEFAULT 2500.00,
ADD COLUMN self_exclusion_until timestamp with time zone,
ADD COLUMN self_exclusion_type text CHECK (self_exclusion_type IN ('30_days', '60_days', '90_days', 'permanent')),
ADD COLUMN is_employee boolean NOT NULL DEFAULT false,
ADD COLUMN contest_count integer NOT NULL DEFAULT 0,
ADD COLUMN is_beginner boolean GENERATED ALWAYS AS (contest_count < 50) STORED;

-- Extend geofence_logs with compliance fields
ALTER TABLE public.geofence_logs
ADD COLUMN contest_id uuid,
ADD COLUMN verification_method text DEFAULT 'ip_lookup';

-- Add compliance fields to transactions
ALTER TABLE public.transactions
ADD COLUMN state_code text,
ADD COLUMN is_taxable boolean NOT NULL DEFAULT false,
ADD COLUMN tax_year integer;

-- Create compliance audit log
CREATE TABLE public.compliance_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  admin_id uuid REFERENCES auth.users(id),
  state_code text,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  description text NOT NULL,
  metadata jsonb,
  ip_address inet,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.state_regulation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for state_regulation_rules (public read)
CREATE POLICY "Anyone can view state regulations"
  ON public.state_regulation_rules
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage state regulations"
  ON public.state_regulation_rules
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for license_registry
CREATE POLICY "Admins can view licenses"
  ON public.license_registry
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage licenses"
  ON public.license_registry
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for compliance_audit_logs
CREATE POLICY "Admins can view compliance logs"
  ON public.compliance_audit_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert compliance logs"
  ON public.compliance_audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_state_regulation_rules_updated_at
  BEFORE UPDATE ON public.state_regulation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_license_registry_updated_at
  BEFORE UPDATE ON public.license_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert state regulation data (based on Vela Wood + existing stateStatuses.json)
INSERT INTO public.state_regulation_rules (state_code, state_name, status, license_required, min_age, head_to_head_allowed, pickem_allowed, parlay_allowed, min_contestants, tax_rate, notes) VALUES
('AL', 'Alabama', 'restricted', false, 19, true, false, false, 2, 0.00, 'DFS not explicitly regulated; proceed cautiously'),
('AK', 'Alaska', 'permitted', false, 18, true, true, true, 2, 0.00, 'No specific DFS legislation'),
('AZ', 'Arizona', 'restricted', false, 21, true, false, false, 2, 0.00, 'Limited fantasy sports law'),
('AR', 'Arkansas', 'restricted', false, 18, true, false, false, 2, 0.00, 'Uncertain legal status'),
('CA', 'California', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('CO', 'Colorado', 'restricted', false, 18, true, false, false, 2, 0.00, 'Limited by gambling laws'),
('CT', 'Connecticut', 'restricted', false, 18, true, false, false, 2, 0.00, 'Regulated under sports betting law'),
('DE', 'Delaware', 'restricted', false, 18, true, true, false, 2, 0.00, 'State lottery monopoly concerns'),
('FL', 'Florida', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('GA', 'Georgia', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('HI', 'Hawaii', 'banned', false, 18, false, false, false, 2, 0.00, 'All gambling prohibited'),
('ID', 'Idaho', 'banned', false, 18, false, false, false, 2, 0.00, 'All gambling prohibited'),
('IL', 'Illinois', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('IN', 'Indiana', 'restricted', true, 18, true, true, false, 2, 9.50, 'Registration required; 9.5% tax'),
('IA', 'Iowa', 'restricted', false, 21, true, false, false, 2, 0.00, 'Restrictive laws'),
('KS', 'Kansas', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('KY', 'Kentucky', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('LA', 'Louisiana', 'restricted', false, 21, true, false, false, 2, 0.00, 'Uncertain legal status'),
('ME', 'Maine', 'restricted', false, 18, true, false, false, 2, 0.00, 'No clear legislation'),
('MD', 'Maryland', 'restricted', true, 18, true, true, false, 3, 0.00, 'License required; min 3 entrants'),
('MA', 'Massachusetts', 'permitted', false, 18, true, true, true, 2, 0.00, 'Regulated and permitted'),
('MI', 'Michigan', 'restricted', false, 18, true, false, false, 2, 0.00, 'Uncertain status'),
('MN', 'Minnesota', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('MS', 'Mississippi', 'restricted', false, 21, true, false, false, 2, 0.00, 'Conservative gambling laws'),
('MO', 'Missouri', 'restricted', false, 18, true, false, false, 2, 0.00, 'No clear DFS law'),
('MT', 'Montana', 'banned', false, 18, false, false, false, 2, 0.00, 'Gambling restrictions'),
('NE', 'Nebraska', 'permitted', false, 19, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('NV', 'Nevada', 'banned', true, 21, false, false, false, 2, 0.00, 'Requires gaming license'),
('NH', 'New Hampshire', 'restricted', false, 18, true, true, false, 2, 0.00, 'Limited regulation'),
('NJ', 'New Jersey', 'restricted', false, 18, true, true, false, 2, 0.00, 'Regulated under gambling law'),
('NM', 'New Mexico', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('NY', 'New York', 'restricted', true, 18, true, true, false, 2, 0.00, 'License required'),
('NC', 'North Carolina', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('ND', 'North Dakota', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('OH', 'Ohio', 'restricted', false, 18, true, false, false, 2, 0.00, 'Regulated under sports betting'),
('OK', 'Oklahoma', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('OR', 'Oregon', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('PA', 'Pennsylvania', 'restricted', false, 18, true, false, false, 2, 0.00, 'Restrictive regulations'),
('RI', 'Rhode Island', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('SC', 'South Carolina', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('SD', 'South Dakota', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('TN', 'Tennessee', 'restricted', true, 18, true, true, false, 3, 0.00, 'Registration required; min 3 entrants'),
('TX', 'Texas', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('UT', 'Utah', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('VT', 'Vermont', 'restricted', false, 18, true, false, false, 2, 0.00, 'Uncertain status'),
('VA', 'Virginia', 'restricted', true, 18, true, true, false, 2, 0.00, 'Registration required'),
('WA', 'Washington', 'banned', false, 18, false, false, false, 2, 0.00, 'All online gambling banned'),
('WV', 'West Virginia', 'restricted', false, 18, true, false, false, 2, 0.00, 'Restrictive laws'),
('WI', 'Wisconsin', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption'),
('WY', 'Wyoming', 'permitted', false, 18, true, true, true, 2, 0.00, 'Legal under skill game exemption');