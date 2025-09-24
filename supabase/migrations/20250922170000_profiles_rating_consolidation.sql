-- Consolidate rating in profiles.rating and remove professionals.rating
begin;

-- 1) Ensure profiles.rating exists
alter table public.profiles add column if not exists rating numeric;

-- 2) Backfill from professionals.rating when present
update public.profiles pr
set rating = p.rating
from public.professionals p
where pr.id = p.id and p.rating is not null;

-- 3) Update rating recalculation to write only into profiles
create or replace function public.recalc_professional_rating(p_user_id uuid)
returns void language plpgsql as $$
declare
  v_avg numeric;
begin
  select avg(stars)::numeric into v_avg from public.ratings where to_user_id = p_user_id;
  update public.profiles pr set rating = v_avg where pr.id = p_user_id;
end $$;

create or replace function public.tg_ratings_recalc_professional()
returns trigger language plpgsql as $$
declare
  v_target uuid;
begin
  if tg_op = 'DELETE' then
    v_target := old.to_user_id;
  else
    v_target := new.to_user_id;
  end if;
  perform public.recalc_professional_rating(v_target);
  return null; -- AFTER trigger, no row change
end $$;

-- 4) Drop dependent index on professionals.rating (if exists)
drop index if exists professionals_featured_rating_idx;

-- 5) Remove rating column from professionals
alter table public.professionals drop column if exists rating;

-- 6) Create compatibility view with rating from profiles
create or replace view public.professionals_with_profile as
select
  p.id,
  p.full_name,
  p.avatar_url,
  p.headline,
  p.bio,
  p.years_experience,
  pr.rating,
  p.is_featured,
  p.active,
  p.empresa,
  p.city,
  p.cities,
  p.categories,
  p.subcategories,
  p.last_active_at,
  p.created_at
from public.professionals p
left join public.profiles pr on pr.id = p.id;

-- 7) Update RPCs to use profiles.rating via join
create or replace function public.get_professionals_browse(p_city text default null, p_category text default null)
returns table (
  id uuid,
  full_name text,
  headline text,
  rating numeric,
  is_featured boolean,
  city text,
  last_active_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id,
         p.full_name,
         p.headline,
         pr.rating,
         p.is_featured,
         p.city,
         p.last_active_at
  from public.professionals p
  join public.profiles pr on pr.id = p.id
  where coalesce(p.active, true) = true
    and (p.last_active_at is null or p.last_active_at > now() - interval '21 days')
    and (p_city is null or p.city = p_city or exists (
          select 1 from jsonb_array_elements_text(coalesce(p.cities,'[]'::jsonb)) c(city)
          where c.city = p_city
        ))
    and (p_category is null or exists (
          select 1 from jsonb_array_elements(coalesce(p.categories, '[]'::jsonb)) pc
          where pc->>'name' = p_category
        ))
  order by p.is_featured desc nulls last,
           pr.rating desc nulls last,
           p.last_active_at desc nulls last
  limit 200;
$$;

revoke all on function public.get_professionals_browse(text, text) from public;
grant execute on function public.get_professionals_browse(text, text) to anon, authenticated;

create or replace function public.get_prospects_for_request(p_request_id uuid)
returns table (
  professional_id uuid,
  full_name text,
  headline text,
  rating numeric,
  is_featured boolean,
  last_active_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id as professional_id,
         p.full_name,
         p.headline,
         pr.rating,
         p.is_featured,
         p.last_active_at
  from public.requests r
  join public.professionals p on true
  join public.profiles pr on pr.id = p.id
  where r.id = p_request_id
    and r.created_by = auth.uid()
    and coalesce(p.active, true) = true
    and (
      p.city = r.city
      or exists (
        select 1 from jsonb_array_elements_text(coalesce(p.cities, '[]'::jsonb)) as c(city)
        where c.city = r.city
      )
    )
    and (
      r.category is null
      or exists (
        select 1 from jsonb_array_elements(coalesce(p.categories, '[]'::jsonb)) pc
        where pc->>'name' = r.category
      )
    )
    and (
      jsonb_array_length(coalesce(r.subcategories, '[]'::jsonb)) = 0
      or exists (
        select 1
        from jsonb_array_elements(coalesce(p.subcategories, '[]'::jsonb)) ps
        join jsonb_array_elements(coalesce(r.subcategories, '[]'::jsonb)) rs
          on (ps->>'name') = (rs->>'name')
      )
    )
  order by p.is_featured desc nulls last,
           pr.rating desc nulls last,
           p.last_active_at desc nulls last
  limit 20;
$$;

revoke all on function public.get_prospects_for_request(uuid) from public;
grant execute on function public.get_prospects_for_request(uuid) to authenticated;

-- 8) Permissions for compatibility view
grant select on public.professionals_with_profile to anon, authenticated;

-- 9) Helpful index on new source of truth
create index if not exists ix_profiles_rating on public.profiles (rating desc nulls last);

commit;

