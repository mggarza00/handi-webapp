-- Add is_admin boolean flag to profiles, if missing
alter table if exists public.profiles
  add column if not exists is_admin boolean default false;

-- Optional: create an index for quick lookups
create index if not exists idx_profiles_is_admin on public.profiles(is_admin);
