-- Migration: add is_client_pro boolean flag to profiles to allow switching between client/pro
-- Run this against your Postgres/Supabase DB (psql or Supabase SQL editor)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_client_pro boolean DEFAULT false;

-- Optional: initialize the flag for existing users that already acted as ambos (cliente y profesional)
-- Example heuristics (uncomment and adapt if desired):
-- UPDATE public.profiles p
-- SET is_client_pro = TRUE
-- FROM (
--   SELECT u.id
--   FROM public.profiles u
--   LEFT JOIN public.requests r ON r.created_by = u.id
--   LEFT JOIN public.applications a ON a.professional_id = u.id
--   GROUP BY u.id
--   HAVING COUNT(r.id) > 0 AND COUNT(a.id) > 0
-- ) s
-- WHERE p.id = s.id;

CREATE INDEX IF NOT EXISTS idx_profiles_is_client_pro ON public.profiles (is_client_pro);
