-- One-time backfill: seed professionals from existing profiles
begin;

insert into public.professionals (id, full_name, avatar_url, headline, bio, years_experience, rating, is_featured, active, city, cities, categories, subcategories, last_active_at, created_at)
select p.id,
       p.full_name,
       p.avatar_url,
       p.headline,
       p.bio,
       p.years_experience,
       p.rating,
       p.is_featured,
       coalesce(p.active, true),
       p.city,
       coalesce(p.cities, '[]'::jsonb),
       coalesce(p.categories, '[]'::jsonb),
       coalesce(p.subcategories, '[]'::jsonb),
       p.last_active_at,
       coalesce(p.created_at, now())
from public.profiles p
where not exists (select 1 from public.professionals pr where pr.id = p.id);

commit;

