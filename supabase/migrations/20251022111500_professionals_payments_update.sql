-- Copied from 20251022_professionals_payments_update.sql with ordering fix
create extension if not exists pgcrypto;

do $$ begin
  perform 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'kyc_status';
  if found then begin alter type public.kyc_status add value if not exists 'needs_info'; exception when others then null; end; end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='professionals') then
    alter table public.professionals add column if not exists rating_avg numeric, add column if not exists jobs_done integer not null default 0;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='professionals' and column_name='created_at') then
      begin alter table public.professionals alter column created_at set default now(); exception when others then null; end;
    end if;
  end if;
end $$;

do $$ begin create type public.payment_status as enum ('pending','paid','refunded','failed','canceled','disputed'); exception when duplicate_object then null; end $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), request_id uuid null,
  amount numeric not null, fee numeric not null default 0, vat numeric not null default 0,
  currency text not null default 'MXN', status public.payment_status not null default 'pending',
  payment_intent_id text null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='requests') then
    alter table public.payments add constraint payments_request_id_fkey foreign key (request_id) references public.requests(id) on delete set null;
  end if;
exception when others then null; end $$;

create index if not exists payments_request_id_idx on public.payments(request_id);
create index if not exists payments_status_idx on public.payments(status);
create index if not exists payments_created_at_idx on public.payments(created_at);

-- updated_at trigger intentionally omitted if helper not present

alter table public.payments enable row level security;
do $$ begin create policy payments_admin_read on public.payments for select using (public.is_admin_jwt()); exception when duplicate_object then null; end $$;
do $$ begin create policy payments_admin_insert on public.payments for insert with check (public.is_admin_jwt()); exception when duplicate_object then null; end $$;
do $$ begin create policy payments_admin_update on public.payments for update using (public.is_admin_jwt()) with check (public.is_admin_jwt()); exception when duplicate_object then null; end $$;
do $$ begin create policy payments_admin_delete on public.payments for delete using (public.is_admin_jwt()); exception when duplicate_object then null; end $$;

create or replace view public.v_kpi_today as
with req as (
  select count(*)::int as requests_today from public.requests where created_at >= date_trunc('day', now())
), pay as (
  select coalesce(sum(amount),0)::numeric as payments_amount_today, count(*)::int as payments_count_today
  from public.payments where created_at >= date_trunc('day', now()) and status in ('paid','refunded')
)
select req.requests_today, pay.payments_amount_today, pay.payments_count_today, now() as generated_at
from req cross join pay;
