-- Migration: add function get_prospects_for_request (matching + ranking V1)
begin;

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
  /*
    Reglas de matching (Documento Maestro §4):
    - Ciudad: p.city = r.city o r.city ∈ p.cities (array de texto)
    - Categoría: si r.category no es null, debe intersectar con p.categories (array de objetos con {name})
    - Subcategorías: si r.subcategories no está vacío, debe haber intersección por name

    Ranking: is_featured desc → rating desc nulls last → last_active_at desc nulls last

    Seguridad: sólo el dueño del request puede ver prospectos (r.created_by = auth.uid()).
  */
  select p.id as professional_id,
         p.full_name,
         p.headline,
         p.rating,
         p.is_featured,
         p.last_active_at
  from public.requests r
  join public.profiles p on true
  where r.id = p_request_id
    and r.created_by = auth.uid()         -- acceso sólo para dueño del request
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
           p.rating desc nulls last,
           p.last_active_at desc nulls last
  limit 20;
$$;

revoke all on function public.get_prospects_for_request(uuid) from public;
grant execute on function public.get_prospects_for_request(uuid) to authenticated;

commit;

