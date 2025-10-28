-- Tabla de favoritos de profesionales por clientes
create table if not exists public.client_favorites (
  client_id uuid not null references public.profiles(id) on delete cascade,
  pro_id uuid not null references public.professionals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, pro_id)
);

-- Índices útiles
create index if not exists client_favorites_client_id_idx on public.client_favorites(client_id);
create index if not exists client_favorites_pro_id_idx on public.client_favorites(pro_id);

-- RLS
alter table public.client_favorites enable row level security;

-- Policies: el cliente solo puede ver/escribir sus propios favoritos
drop policy if exists "client can select own favorites" on public.client_favorites;
create policy "client can select own favorites"
  on public.client_favorites
  for select
  using (auth.uid() = client_id);

drop policy if exists "client can insert own favorites" on public.client_favorites;
create policy "client can insert own favorites"
  on public.client_favorites
  for insert
  with check (auth.uid() = client_id);

drop policy if exists "client can delete own favorites" on public.client_favorites;
create policy "client can delete own favorites"
  on public.client_favorites
  for delete
  using (auth.uid() = client_id);

