-- Tabla de calificaciones post-servicio
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz default now()
);
alter table public.ratings enable row level security;

-- Tabla para galeria de servicios realizados
create table if not exists public.service_photos (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.agreements(id) on delete cascade,
  request_id uuid not null references public.requests(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  uploaded_at timestamptz default now()
);
alter table public.service_photos enable row level security;
