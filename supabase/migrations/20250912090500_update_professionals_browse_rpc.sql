-- Update get_professionals_browse to read from professionals instead of profiles
begin;

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
         p.rating,
         p.is_featured,
         p.city,
         p.last_active_at
  from public.professionals p
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
           p.rating desc nulls last,
           p.last_active_at desc nulls last
  limit 200;
$$;

revoke all on function public.get_professionals_browse(text, text) from public;
grant execute on function public.get_professionals_browse(text, text) to anon, authenticated;

commit;

