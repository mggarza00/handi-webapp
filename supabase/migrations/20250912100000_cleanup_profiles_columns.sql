-- Cleanup profiles: drop professional-specific columns and old indexes
begin;

-- Drop indexes that referenced removed columns
drop index if exists ix_profiles_last_active;
drop index if exists ix_profiles_featured_rating;

-- Drop columns if they exist (moved to public.professionals)
alter table public.profiles drop column if exists headline;
alter table public.profiles drop column if exists bio;
alter table public.profiles drop column if exists years_experience;
alter table public.profiles drop column if exists rating;
alter table public.profiles drop column if exists is_featured;
alter table public.profiles drop column if exists active;
alter table public.profiles drop column if exists city;
alter table public.profiles drop column if exists cities;
alter table public.profiles drop column if exists categories;
alter table public.profiles drop column if exists subcategories;
alter table public.profiles drop column if exists last_active_at;

commit;

