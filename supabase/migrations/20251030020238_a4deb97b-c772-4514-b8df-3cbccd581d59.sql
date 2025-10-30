-- Insert sample state regulation rules for key states if not exists
-- This provides detailed compliance information for display

INSERT INTO public.state_regulation_rules (state_code, state_name, status, min_age, requires_skill_predominance, license_required, notes)
VALUES
('MA', 'Massachusetts', 'regulated', 21, true, true, 'Licensed operator. Age 21+. Skill-based contests permitted with proper licensing.'),
('NH', 'New Hampshire', 'regulated', 18, true, true, 'Registered with state gaming authority. Age 18+.'),
('NY', 'New York', 'regulated', 18, true, true, 'Licensed under NY Gaming Commission. Skill-based DFS permitted.'),
('MD', 'Maryland', 'regulated', 18, true, true, 'Licensed operator. Must verify identity and age before play.')
ON CONFLICT (state_code) DO UPDATE SET
  status = EXCLUDED.status,
  min_age = EXCLUDED.min_age,
  requires_skill_predominance = EXCLUDED.requires_skill_predominance,
  license_required = EXCLUDED.license_required,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Insert sample license registry entries for regulated states
INSERT INTO public.license_registry (state_code, license_type, license_number, status, issued_date, expiry_date, notes, renewal_link)
VALUES
(
  'MA',
  'operator',
  'MA-DFS-2024-001',
  'active',
  '2024-01-15',
  '2025-12-31',
  'Massachusetts Gaming Commission - Daily Fantasy Sports Operator License',
  'https://massgaming.com/licensing/'
),
(
  'NH',
  'registration',
  'NH-REG-2024-789',
  'active',
  '2024-02-01',
  '2026-01-31',
  'New Hampshire Lottery Commission - DFS Registration',
  'https://www.nhlottery.com/'
),
(
  'NY',
  'operator',
  'NY-DFS-2024-456',
  'active',
  '2024-01-10',
  '2025-12-31',
  'New York State Gaming Commission - Interactive Fantasy Sports License',
  'https://gaming.ny.gov/'
),
(
  'MD',
  'operator',
  'MD-SWARC-2024-123',
  'active',
  '2024-03-01',
  '2026-02-28',
  'Maryland State Lottery and Gaming Control Agency',
  'https://www.mdgaming.com/'
)
ON CONFLICT (state_code, license_type) DO NOTHING;