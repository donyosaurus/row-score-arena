-- Deduplicate existing user_consents rows before adding unique constraint
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, doc_slug, version
    ORDER BY consented_at DESC, id DESC
  ) AS rn
  FROM public.user_consents
)
DELETE FROM public.user_consents uc
USING ranked r
WHERE uc.id = r.id AND r.rn > 1;

-- Now (re)try to add the unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_consents_user_doc_version_key'
  ) THEN
    ALTER TABLE public.user_consents ADD CONSTRAINT user_consents_user_doc_version_key UNIQUE (user_id, doc_slug, version);
  END IF;
END $$;