-- Support cases & omnicanal disputes
create extension if not exists pgcrypto;

-- support_cases
create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  provider_id uuid null references auth.users(id) on delete set null,
  request_id uuid null references public.requests(id) on delete set null,
  agreement_id uuid null references public.agreements(id) on delete set null,
  payment_id uuid null references public.payments(id) on delete set null,
  channel_origin text not null check (channel_origin in ('help_center','assistant','whatsapp','admin')) default 'whatsapp',
  type text not null check (type in ('pago','servicio_no_realizado','problema_tecnico','reembolso','queja','otro')) default 'otro',
  priority text not null check (priority in ('baja','media','alta','critica')) default 'media',
  status text not null check (status in ('nuevo','en_proceso','esperando_cliente','resuelto','cerrado')) default 'nuevo',
  assigned_admin_id uuid null references auth.users(id) on delete set null,
  subject text null,
  description text null,
  sla_due_at timestamptz null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'tg_support_cases_updated_at') then
    create trigger tg_support_cases_updated_at
    before update on public.support_cases
    for each row execute function public.tg_set_updated_at();
  end if;
end $$;

create index if not exists ix_support_cases_status_last_activity on public.support_cases (status, last_activity_at desc);
create index if not exists ix_support_cases_priority_sla on public.support_cases (priority, sla_due_at);
create index if not exists ix_support_cases_user on public.support_cases (user_id);

alter table public.support_cases enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_cases' and policyname = 'support_cases_read'
  ) then
    create policy support_cases_read on public.support_cases for select using (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_cases' and policyname = 'support_cases_insert'
  ) then
    create policy support_cases_insert on public.support_cases for insert with check (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_cases' and policyname = 'support_cases_update'
  ) then
    create policy support_cases_update on public.support_cases for update using (public.has_admin_access());
  end if;
end $$;

-- support_case_events
create table if not exists public.support_case_events (
  id bigserial primary key,
  case_id uuid not null references public.support_cases(id) on delete cascade,
  kind text not null check (kind in ('message_in','message_out','internal_note','status_change','assignment','refund','tag','system')),
  channel text not null check (channel in ('whatsapp','assistant','help_center','admin')),
  author_type text not null check (author_type in ('customer','provider','admin','system')),
  author_id uuid null,
  body_text text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_support_case_events_case_created on public.support_case_events (case_id, created_at asc);

alter table public.support_case_events enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_case_events' and policyname = 'support_case_events_read'
  ) then
    create policy support_case_events_read on public.support_case_events for select using (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_case_events' and policyname = 'support_case_events_insert'
  ) then
    create policy support_case_events_insert on public.support_case_events for insert with check (public.has_admin_access());
  end if;
end $$;

-- whatsapp_threads
create table if not exists public.whatsapp_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  phone_e164 text not null,
  wa_id text null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'tg_whatsapp_threads_updated_at') then
    create trigger tg_whatsapp_threads_updated_at
    before update on public.whatsapp_threads
    for each row execute function public.tg_set_updated_at();
  end if;
end $$;

create unique index if not exists ux_whatsapp_threads_phone on public.whatsapp_threads (phone_e164);

alter table public.whatsapp_threads enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_threads' and policyname = 'whatsapp_threads_read'
  ) then
    create policy whatsapp_threads_read on public.whatsapp_threads for select using (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_threads' and policyname = 'whatsapp_threads_insert'
  ) then
    create policy whatsapp_threads_insert on public.whatsapp_threads for insert with check (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_threads' and policyname = 'whatsapp_threads_update'
  ) then
    create policy whatsapp_threads_update on public.whatsapp_threads for update using (public.has_admin_access());
  end if;
end $$;
