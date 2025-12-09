-- Tabla de favoritos de requests por profesional
create table if not exists public.pro_request_favorites (
  pro_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null references public.requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pro_id, request_id)
);

-- Índices útiles
create index if not exists pro_request_favorites_pro_id_idx on public.pro_request_favorites(pro_id);
create index if not exists pro_request_favorites_request_id_idx on public.pro_request_favorites(request_id);

-- RLS
alter table public.pro_request_favorites enable row level security;

-- Policies: El pro solo ve y escribe lo suyo (CREATE POLICY no soporta IF NOT EXISTS)
drop policy if exists "pro can select own favorites" on public.pro_request_favorites;
create policy "pro can select own favorites"
  on public.pro_request_favorites
  for select
  using (auth.uid() = pro_id);

drop policy if exists "pro can insert own favorites" on public.pro_request_favorites;
create policy "pro can insert own favorites"
  on public.pro_request_favorites
  for insert
  with check (auth.uid() = pro_id);

drop policy if exists "pro can delete own favorites" on public.pro_request_favorites;
create policy "pro can delete own favorites"
  on public.pro_request_favorites
  for delete
  using (auth.uid() = pro_id);
