-- Phase 4: Add age verification and withdrawal tracking fields

-- Add DOB and age confirmation to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS age_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawal_last_requested_at timestamptz;

-- Add deposit timestamp tracking to transactions for 24-hour hold
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS deposit_timestamp timestamptz;

-- Update existing deposit transactions to have deposit_timestamp
UPDATE public.transactions
SET deposit_timestamp = created_at
WHERE type = 'deposit' AND deposit_timestamp IS NULL;

-- Create index for efficient withdrawal limit queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_created 
  ON public.transactions(user_id, type, created_at DESC);

-- Create index for efficient pending withdrawal check
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_type 
  ON public.transactions(user_id, status, type);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.date_of_birth IS 'User date of birth for age verification';
COMMENT ON COLUMN public.profiles.age_confirmed_at IS 'Timestamp when user confirmed they are 18+';
COMMENT ON COLUMN public.profiles.withdrawal_last_requested_at IS 'Last withdrawal request time for cooldown enforcement';
COMMENT ON COLUMN public.transactions.deposit_timestamp IS 'When funds were deposited, used for 24-hour hold before withdrawal';