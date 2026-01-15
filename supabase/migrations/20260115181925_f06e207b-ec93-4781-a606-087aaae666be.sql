-- Drop ALL existing versions of update_wallet_balance to resolve ambiguity
DROP FUNCTION IF EXISTS public.update_wallet_balance(uuid, bigint, bigint, bigint, bigint, bigint);
DROP FUNCTION IF EXISTS public.update_wallet_balance(uuid, numeric, numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.update_wallet_balance(uuid, bigint, bigint);
DROP FUNCTION IF EXISTS public.update_wallet_balance(uuid, numeric, numeric);

-- Recreate with a single unambiguous signature using bigint
CREATE OR REPLACE FUNCTION public.update_wallet_balance(
  _wallet_id uuid,
  _available_delta bigint,
  _pending_delta bigint,
  _lifetime_deposits_delta bigint DEFAULT 0,
  _lifetime_winnings_delta bigint DEFAULT 0,
  _lifetime_withdrawals_delta bigint DEFAULT 0
)
RETURNS TABLE(success boolean, available_balance bigint, pending_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_available bigint;
  v_new_pending bigint;
BEGIN
  UPDATE wallets
  SET 
    available_balance = wallets.available_balance + _available_delta,
    pending_balance = wallets.pending_balance + _pending_delta,
    lifetime_deposits = wallets.lifetime_deposits + _lifetime_deposits_delta,
    lifetime_winnings = wallets.lifetime_winnings + _lifetime_winnings_delta,
    lifetime_withdrawals = wallets.lifetime_withdrawals + _lifetime_withdrawals_delta,
    updated_at = now()
  WHERE id = _wallet_id
  RETURNING wallets.available_balance, wallets.pending_balance 
  INTO v_new_available, v_new_pending;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: %', _wallet_id;
  END IF;

  RETURN QUERY SELECT true, v_new_available, v_new_pending;
END;
$function$;