-- Drop duplicate professional fields from public.profiles
-- These fields now live in public.professionals
begin;

alter table if exists public.profiles drop column if exists headline;
alter table if exists public.profiles drop column if exists bio;
alter table if exists public.profiles drop column if exists years_experience;
alter table if exists public.profiles drop column if exists city;
alter table if exists public.profiles drop column if exists cities;
alter table if exists public.profiles drop column if exists categories;
alter table if exists public.profiles drop column if exists subcategories;

commit;

