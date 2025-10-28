-- Admin MVP: settings, audit log y webhooks
create extension if not exists pgcrypto;

-- Helper: función para RBAC admin
create or replace function public.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (is_admin = true) or (lower(role) in ('owner','admin','ops','finance','support','reviewer'))
       from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.has_admin_access() is 'Devuelve true si el usuario actual tiene rol de acceso a /admin.';

-- Configuración (comisiones/IVA)
create table if not exists public.admin_settings (
  id int primary key default 1,
  commission_percent numeric not null default 10,
  vat_percent numeric not null default 16,
  updated_by uuid null,
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;
create policy admin_settings_read on public.admin_settings for select using (public.has_admin_access());
create policy admin_settings_write on public.admin_settings for update using (public.has_admin_access());

-- Audit log
create table if not exists public.audit_log (
  id bigserial primary key,
  action text not null,
  actor_id uuid null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy audit_log_read on public.audit_log for select using (public.has_admin_access());
create policy audit_log_write on public.audit_log for insert with check (public.has_admin_access());

-- Webhooks monitor
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event text not null,
  status text not null check (status in ('ok','error')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.webhook_events enable row level security;
create policy webhook_events_read on public.webhook_events for select using (public.has_admin_access());
create policy webhook_events_write on public.webhook_events for insert with check (public.has_admin_access());

-- Seed inicial settings si no existe
insert into public.admin_settings (id, commission_percent, vat_percent)
  values (1, 10, 16)
on conflict (id) do nothing;

