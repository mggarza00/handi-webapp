-- Seed 30 demo professionals based on existing auth.users without a professionals row
-- Safe to run multiple times: only inserts for users not present in public.professionals

with base as (
  select
    au.id,
    coalesce((au.raw_user_meta_data ->> 'full_name'), 'Usuario ' || left(au.id::text, 8)) as base_name
  from auth.users au
  left join public.professionals p on p.id = au.id
  where p.id is null
  order by au.created_at desc
  limit 30
),
city_pool as (
  -- Canonical cities used by the app (must match lib/cities.ts)
  select unnest(array[
    'Monterrey',
    'Guadalupe',
    'San Nicolás',
    'Apodaca',
    'Escobedo',
    'Santa Catarina',
    'García',
    'San Pedro Garza García'
  ])::text as city
),
picks as (
  select
    b.id,
    b.base_name || ' DEMO' as full_name,
    -- Headline and bio demo
    (array['Plomería','Electricidad','Carpintería','Pintura','Albañilería','Clima/AC','Jardinería','Cerrajería'])[1 + floor(random()*8)]::text as headline,
    'Perfil DEMO. Experto en oficios. Este perfil es temporal para pruebas y será eliminado en producción.' as bio,
    -- Experience 1..15
    (1 + floor(random()*15))::int as years_experience,
    -- Rating 3.5..5.0 (una cifra decimal)
    round( (3.5 + random()*1.5)::numeric, 1) as rating,
    -- 25% destacados
    (random() < 0.25) as is_featured,
    true as active,
    -- City pick (canonical)
    (select city from city_pool order by random() limit 1) as city,
    -- Cities JSONB (city + another random, may duplicate)
    to_jsonb(array[
      (select city from city_pool order by random() limit 1),
      (select city from city_pool order by random() limit 1)
    ]::text[]) as cities,
    -- Categories/Subcategories from catalog when available; fall back to defaults
    -- Pick a random category from catalog
    jsonb_build_array(
      jsonb_build_object(
        'name', coalesce((
          select c."Categoría" from public.categories_subcategories c
          group by c."Categoría" order by random() limit 1
        ), 'Instalaciones')
      )
    ) as categories,
    -- Pick a random subcategory (preferably aligned to chosen category); fallback to 'Plomería'
    coalesce(
      to_jsonb(array[
        jsonb_build_object('name', coalesce((
          select cs."Subcategoría"
          from public.categories_subcategories cs
          where cs."Categoría" = (
            select c2."Categoría" from public.categories_subcategories c2
            group by c2."Categoría" order by random() limit 1
          )
          order by random() limit 1
        ), 'Plomería'))
      ]),
      jsonb_build_array(jsonb_build_object('name','Plomería'))
    ) as subcategories,
    (now() - (random() * interval '10 days')) as last_active_at
  from base b
)
insert into public.professionals (
  id,
  full_name,
  avatar_url,
  headline,
  bio,
  years_experience,
  rating,
  is_featured,
  active,
  city,
  cities,
  categories,
  subcategories,
  last_active_at,
  created_at
)
select
  id,
  full_name,
  -- Placeholder avatar (puedes reemplazar luego)
  ('https://i.pravatar.cc/256?img=' || (1 + floor(random()*70))::int)::text as avatar_url,
  headline,
  bio,
  years_experience,
  rating,
  is_featured,
  active,
  city,
  cities,
  categories,
  subcategories,
  last_active_at,
  now()
from picks;

-- To remove all DEMO professionals later:
-- delete from public.professionals where full_name like '% DEMO';
