
-- ============================================================
-- Fix 1: Restrict profiles UPDATE to safe columns only
-- Prevents users from self-promoting kyc_status, is_employee, etc.
-- ============================================================

-- Revoke blanket UPDATE, then grant only safe columns
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  username, full_name, 
  address_line1, address_line2, city, state, zip_code, phone,
  date_of_birth
) ON public.profiles TO authenticated;

-- ============================================================
-- Fix 2: Restrict support_tickets INSERT policy
-- Currently WITH CHECK (true) — any authenticated user can insert
-- with arbitrary user_id. Restrict to own user_id or null.
-- ============================================================

DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;
CREATE POLICY "Users can create tickets"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
