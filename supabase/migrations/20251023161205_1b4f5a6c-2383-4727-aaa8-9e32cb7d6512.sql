-- Add column to track when username was last changed
ALTER TABLE public.profiles
ADD COLUMN username_last_changed_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing records to set the initial timestamp
UPDATE public.profiles
SET username_last_changed_at = created_at
WHERE username_last_changed_at IS NULL;