-- Allow contest_entries.pool_id to reference either table (drop FK, keep column)
ALTER TABLE public.contest_entries 
  DROP CONSTRAINT IF EXISTS contest_entries_pool_id_fkey;

-- Add scored to valid entry statuses
ALTER TABLE public.contest_entries DROP CONSTRAINT contest_entries_status_check;
ALTER TABLE public.contest_entries ADD CONSTRAINT contest_entries_status_check 
  CHECK (status = ANY (ARRAY['active','scored','withdrawn','settled','refunded','voided']));