
-- Add logo_url column to contest_pool_crews
ALTER TABLE public.contest_pool_crews ADD COLUMN IF NOT EXISTS logo_url text;
