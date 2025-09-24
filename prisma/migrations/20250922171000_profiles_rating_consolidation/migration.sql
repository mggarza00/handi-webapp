-- Prisma migration to align with rating consolidation
-- Source of truth for schema changes is Supabase migrations under supabase/migrations.
-- This migration is idempotent and safe to apply after the Supabase SQL has run.

BEGIN;

-- Ensure profiles.rating exists with desired precision
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS rating numeric(2,1);

-- Drop professionals.rating if still present
ALTER TABLE IF EXISTS public.professionals
  DROP COLUMN IF EXISTS rating;

COMMIT;

