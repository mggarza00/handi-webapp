with targets as (
  select p.id,
         coalesce(nullif(p.full_name, ''),
                  (select coalesce(pr.full_name, 'Usuario '||left(p.id::text,8)) from public.profiles pr where pr.id = p.id)
         ) as base_name
  from public.professionals p
  where (p.full_name is null or lower(p.full_name) like '%seed%')
    and (p.full_name is null or p.full_name not ilike '% DEMO')
  order by coalesce(p.last_active_at, now() - interval '100 days') asc
  limit 30
),
city_pool as (
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
rpick as (
  select
    (select city from city_pool order by random() limit 1) as c1,
    (select city from city_pool order by random() limit 1) as c2
),
cpick as (
  select
    (select c."Categoría" from public.categories_subcategories c group by c."Categoría" order by random() limit 1) as category,
    (select cs."Subcategoría" from public.categories_subcategories cs order by random() limit 1) as sub
)
update public.professionals p
set
  full_name = case when t.base_name is null or t.base_name = ''
                   then 'Usuario '||left(p.id::text,8)||' DEMO'
                   else t.base_name||' DEMO' end,
  avatar_url = coalesce(p.avatar_url, ('https://i.pravatar.cc/256?img=' || (1 + floor(random()*70))::int)::text),
  headline = coalesce(p.headline,
              (array['Plomería','Electricidad','Carpintería','Pintura','Albañilería','Clima/AC','Jardinería','Cerrajería'])[1 + floor(random()*8)]::text),
  bio = coalesce(p.bio, 'Perfil DEMO. Experto en oficios. Este perfil es temporal para pruebas y será eliminado en producción.'),
  years_experience = coalesce(p.years_experience, (1 + floor(random()*15))::int),
  rating = coalesce(p.rating, round( (3.5 + random()*1.5)::numeric, 1)),
  is_featured = coalesce(p.is_featured, (random() < 0.25)),
  active = true,
  city = case when p.city = 'San Pedro' then 'San Pedro Garza García' else coalesce(p.city, rpick.c1) end,
  cities = coalesce(
    p.cities,
    to_jsonb(array[
      (case when p.city = 'San Pedro' then 'San Pedro Garza García' else coalesce(p.city, rpick.c1) end),
      rpick.c2
    ]::text[])
  ),
  categories = coalesce(
    p.categories,
    jsonb_build_array(
      jsonb_build_object('name', coalesce(cpick.category, 'Instalaciones'))
    )
  ),
  subcategories = coalesce(
    p.subcategories,
    to_jsonb(array[
      jsonb_build_object('name', coalesce(cpick.sub, 'Plomería'))
    ])
  ),
  last_active_at = now()
from targets t, rpick, cpick
where p.id = t.id;

-- Cleanup helper for later:
-- delete from public.professionals where full_name ilike '% DEMO';
