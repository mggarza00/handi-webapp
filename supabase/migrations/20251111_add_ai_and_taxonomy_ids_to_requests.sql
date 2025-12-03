-- Add AI metadata and taxonomy IDs to public.requests
-- Safe, idempotent-style guards where supported

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS category_id uuid;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS subcategory_id uuid;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS ai_confidence numeric;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS ai_model text;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS ai_overridden boolean NOT NULL DEFAULT false;

-- FK to categories_subcategories (subcategory row ID)
DO $$ BEGIN
  ALTER TABLE public.requests
    ADD CONSTRAINT requests_subcategory_id_fkey
    FOREIGN KEY (subcategory_id)
    REFERENCES public.categories_subcategories("categories_subcategories_id")
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_requests_subcategory_id ON public.requests (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_requests_ai_confidence ON public.requests (ai_confidence);

