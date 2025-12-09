-- Increase bucket size limits to 10 MB for pro-apply uploads
-- Buckets targeted:
--   - 'pro-verifications' (used for pro onboarding document uploads)
--   - 'requests' (default in some storage endpoints)

-- 10 MB in bytes
DO $$
BEGIN
  -- If the storage schema is unavailable (older local setups), skip gracefully
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage.buckets not found; skipping migration';
    RETURN;
  END IF;

  -- Ensure pro-verifications bucket exists with 10MB and proper mime types
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'pro-verifications') THEN
    BEGIN
      PERFORM storage.create_bucket(
        id => 'pro-verifications'::text,
        name => 'pro-verifications'::text,
        public => true,
        file_size_limit => 10485760::bigint,
        allowed_mime_types => ARRAY[
          'image/*',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]::text[]
      );
    EXCEPTION WHEN undefined_function THEN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'pro-verifications', 'pro-verifications', true, 10485760::bigint,
        ARRAY['image/*','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;
    END;
  END IF;

  -- Raise size limit to 10MB for pro-verifications if it already existed
  UPDATE storage.buckets
     SET file_size_limit = 10485760,
         allowed_mime_types = ARRAY[
           'image/*',
           'application/pdf',
           'application/msword',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
         ]::text[]
   WHERE id = 'pro-verifications';

  -- Note: requests bucket mantiene 5MB; no se modifica aquí
END $$;
