-- Update all DEMO professionals' full_name to a random "Nombre Apellido Demo"
-- Identifies DEMO by current names ending with " DEMO" (case-insensitive)

-- Preview helpers (optional):
-- select id, full_name from public.professionals where full_name ilike '%demo%';
-- select id, full_name, left(bio,60) bio from public.professionals where bio ilike '%demo%';

with targets as (
  select id
  from public.professionals
  where coalesce(full_name, '') ilike '% demo'
     or coalesce(bio, '') ilike '%demo%'
), picks as (
  select
    t.id,
    -- Random first name
    (array[
      'Jorge','Luis','Carlos','Miguel','Pedro','Sergio','Diego','Hugo','Rafael','Daniel',
      'Fernando','Mario','Alberto','Ricardo','Hector','Eduardo','Manuel','Alejandro','Andres','Ivan'
    ])[1 + floor(random()*20)]::text as first_name,
    -- Random last name
    (array[
      'Garcia','Martinez','Lopez','Gonzalez','Perez','Rodriguez','Sanchez','Ramirez','Cruz','Flores',
      'Hernandez','Gomez','Vazquez','Torres','Diaz','Vargas','Reyes','Morales','Ortiz','Gutierrez'
    ])[1 + floor(random()*20)]::text as last_name
  from targets t
)
update public.professionals p
set full_name = picks.first_name || ' ' || picks.last_name || ' Demo'
from picks
where p.id = picks.id
returning p.id, picks.first_name || ' ' || picks.last_name || ' Demo' as new_full_name;

-- Optional: also mirror to profiles.full_name for the same users
-- Uncomment if desired
-- with targets as (
--   select id from public.professionals where coalesce(full_name,'') ilike '% demo' or coalesce(bio,'') ilike '%demo%'
-- ), picks as (
--   select
--     t.id,
--     (array['Jorge','Luis','Carlos','Miguel','Pedro','Sergio','Diego','Hugo','Rafael','Daniel',
--            'Fernando','Mario','Alberto','Ricardo','Hector','Eduardo','Manuel','Alejandro','Andres','Ivan'
--     ])[1 + floor(random()*20)]::text as first_name,
--     (array['Garcia','Martinez','Lopez','Gonzalez','Perez','Rodriguez','Sanchez','Ramirez','Cruz','Flores',
--            'Hernandez','Gomez','Vazquez','Torres','Diaz','Vargas','Reyes','Morales','Ortiz','Gutierrez'
--     ])[1 + floor(random()*20)]::text as last_name
--   from targets t
-- )
-- update public.profiles pr
-- set full_name = picks.first_name || ' ' || picks.last_name || ' Demo'
-- from picks
-- where pr.id = picks.id;
