-- Migration: add is_client and is_professional boolean flags to profiles
-- Run this against your Postgres/Supabase DB (e.g. psql or supabase sql)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_client boolean DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_professional boolean DEFAULT false;

-- Optionally, migrate existing roles into flags
-- UPDATE public.profiles SET is_client = TRUE WHERE role = 'client';
-- UPDATE public.profiles SET is_professional = TRUE WHERE role = 'pro';

-- Create an index to speed up lookups by is_professional
CREATE INDEX IF NOT EXISTS idx_profiles_is_professional ON public.profiles (is_professional);
