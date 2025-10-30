-- Fix Critical Security Issues: RLS Policies

-- 1. Fix match_queue UPDATE policy - make it more restrictive
DROP POLICY IF EXISTS "System can update queue" ON public.match_queue;

-- Only allow users to cancel their own pending entries
CREATE POLICY "Users can cancel own pending entries"
ON public.match_queue FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (status = 'cancelled');

-- Admins can update any entry
CREATE POLICY "Admins can update queue"
ON public.match_queue FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add missing DELETE policy for match_queue
CREATE POLICY "Admins can delete queue entries"
ON public.match_queue FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix payment_sessions UPDATE policy - make truly immutable to users
DROP POLICY IF EXISTS "Payment sessions are immutable to users" ON public.payment_sessions;

-- Users cannot update their sessions at all
CREATE POLICY "Users cannot update payment sessions"
ON public.payment_sessions FOR UPDATE
TO authenticated
USING (false);

-- 3. Fix transactions UPDATE policy - allow status updates only
DROP POLICY IF EXISTS "Transactions are immutable" ON public.transactions;

-- Allow status updates from pending to final states only
CREATE POLICY "System can update transaction status"
ON public.transactions FOR UPDATE
USING (status = 'pending')
WITH CHECK (
  status IN ('completed', 'failed') AND
  -- Ensure other critical fields cannot be changed
  user_id = (SELECT t.user_id FROM transactions t WHERE t.id = transactions.id) AND
  wallet_id = (SELECT t.wallet_id FROM transactions t WHERE t.id = transactions.id) AND
  amount = (SELECT t.amount FROM transactions t WHERE t.id = transactions.id) AND
  type = (SELECT t.type FROM transactions t WHERE t.id = transactions.id)
);

-- Admins can update any transaction
CREATE POLICY "Admins can update transactions"
ON public.transactions FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));