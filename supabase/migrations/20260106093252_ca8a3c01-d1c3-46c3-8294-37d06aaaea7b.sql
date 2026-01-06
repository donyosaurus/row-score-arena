-- Create atomic withdraw_contest_entry function
CREATE OR REPLACE FUNCTION public.withdraw_contest_entry(p_user_id uuid, p_contest_pool_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pool record;
  v_entry record;
  v_entry_fee_cents bigint;
BEGIN
  -- Lock the contest pool row to prevent concurrent modifications
  SELECT * INTO v_pool
  FROM contest_pools
  WHERE id = p_contest_pool_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest pool not found';
  END IF;
  
  -- Check if lock time has passed
  IF now() >= v_pool.lock_time THEN
    RAISE EXCEPTION 'Contest is locked. Cannot withdraw.';
  END IF;
  
  -- Check if pool is still open
  IF v_pool.status != 'open' THEN
    RAISE EXCEPTION 'Contest is not open. Cannot withdraw.';
  END IF;
  
  -- Find user's active entry in this pool
  SELECT * INTO v_entry
  FROM contest_entries
  WHERE user_id = p_user_id
    AND pool_id = p_contest_pool_id
    AND status = 'active'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found';
  END IF;
  
  -- Get entry fee for refund
  v_entry_fee_cents := v_entry.entry_fee_cents;
  
  -- Execute the withdrawal atomically
  
  -- 1. Update entry status to withdrawn
  UPDATE contest_entries
  SET status = 'withdrawn',
      updated_at = now()
  WHERE id = v_entry.id;
  
  -- 2. Decrement current_entries in contest_pools
  UPDATE contest_pools
  SET current_entries = current_entries - 1
  WHERE id = p_contest_pool_id;
  
  -- 3. Insert refund into ledger_entries (positive amount)
  INSERT INTO ledger_entries (
    user_id,
    amount,
    transaction_type,
    description,
    reference_id
  ) VALUES (
    p_user_id,
    v_entry_fee_cents,
    'REFUND',
    'Contest Withdrawal',
    v_entry.id
  );
  
  -- Return success with refund details
  RETURN jsonb_build_object(
    'success', true,
    'refunded_amount', v_entry_fee_cents,
    'entry_id', v_entry.id
  );
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.withdraw_contest_entry(uuid, uuid) TO authenticated;