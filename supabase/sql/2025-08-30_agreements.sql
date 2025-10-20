-- AGREEMENTS (mínimo viable para pagos/confirmaciones)

-- Extensiones (idempotentes, por si aún no están)
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Tabla
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  amount numeric, -- monto acordado (si aplica)
  status text check (status in (
    'negotiating','accepted','paid','in_progress','completed','cancelled','disputed'
  )) default 'negotiating',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.agreements enable row level security;

-- Policies (drop si existen y re-crear)
drop policy if exists "agreements.select.parties" on public.agreements;
drop policy if exists "agreements.insert.by_parties" on public.agreements;
drop policy if exists "agreements.update.by_parties" on public.agreements;

create policy "agreements.select.parties" on public.agreements
for select using (
  exists (select 1 from public.requests r where r.id = agreements.request_id and r.created_by = auth.uid())
  or professional_id = auth.uid()
);

create policy "agreements.insert.by_parties" on public.agreements
for insert with check (
  exists (select 1 from public.requests r where r.id = request_id and r.created_by = auth.uid())
  or professional_id = auth.uid()
);

create policy "agreements.update.by_parties" on public.agreements
for update using (
  exists (select 1 from public.requests r where r.id = agreements.request_id and r.created_by = auth.uid())
  or professional_id = auth.uid()
);

-- Trigger updated_at
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_updated_at_agreements on public.agreements;
create trigger set_updated_at_agreements
before update on public.agreements
for each row execute function public.tg_set_updated_at();
