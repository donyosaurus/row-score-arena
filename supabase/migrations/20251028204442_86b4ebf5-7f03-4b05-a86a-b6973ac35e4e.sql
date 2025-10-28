-- Fix Payment Sessions RLS - Make sessions immutable after creation
-- Drop existing UPDATE policy that allows users to modify sessions
DROP POLICY IF EXISTS "System can update payment sessions" ON payment_sessions;

-- Create restrictive policy - only service role can update (via edge functions)
-- Users cannot update payment sessions at all
CREATE POLICY "Payment sessions are immutable to users"
ON payment_sessions
FOR UPDATE
TO authenticated
USING (false);

-- Create wallet balance atomic update function to prevent race conditions
CREATE OR REPLACE FUNCTION update_wallet_balance(
  _wallet_id uuid,
  _available_delta numeric,
  _pending_delta numeric,
  _lifetime_deposits_delta numeric DEFAULT 0,
  _lifetime_withdrawals_delta numeric DEFAULT 0,
  _lifetime_winnings_delta numeric DEFAULT 0
)
RETURNS TABLE(
  available_balance numeric,
  pending_balance numeric,
  success boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_available numeric;
BEGIN
  -- Calculate new available balance
  SELECT wallets.available_balance + _available_delta INTO _new_available
  FROM wallets
  WHERE id = _wallet_id;
  
  -- Check if sufficient balance
  IF _new_available < 0 THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, false;
    RETURN;
  END IF;
  
  -- Perform atomic update
  UPDATE wallets
  SET 
    available_balance = available_balance + _available_delta,
    pending_balance = pending_balance + _pending_delta,
    lifetime_deposits = lifetime_deposits + _lifetime_deposits_delta,
    lifetime_withdrawals = lifetime_withdrawals + _lifetime_withdrawals_delta,
    lifetime_winnings = lifetime_winnings + _lifetime_winnings_delta,
    updated_at = now()
  WHERE id = _wallet_id
    AND available_balance + _available_delta >= 0
  RETURNING 
    wallets.available_balance, 
    wallets.pending_balance,
    true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, false;
    RETURN;
  END IF;
END;
$$;