-- Fix balance checks used by contest entry
-- Root cause: some users can have wallet balances but no ledger_entries yet; get_user_balance() should reflect wallets.available_balance.

DROP FUNCTION IF EXISTS public.get_user_balance(uuid);

CREATE FUNCTION public.get_user_balance(target_user_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT w.available_balance::bigint FROM public.wallets w WHERE w.user_id = target_user_id),
    0
  );
$$;

REVOKE ALL ON FUNCTION public.get_user_balance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_balance(uuid) TO authenticated;