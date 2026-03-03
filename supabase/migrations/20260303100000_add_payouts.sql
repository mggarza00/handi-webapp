-- Add payouts table and payouts helpers
create extension if not exists pgcrypto;

-- Add metadata to payments for traceability
alter table public.payments add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Add Stripe Connect account id to professionals
alter table public.professionals add column if not exists stripe_account_id text;

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid null,
  request_id uuid null,
  professional_id uuid not null,
  amount numeric not null,
  currency text not null default 'MXN',
  status text not null default 'pending',
  stripe_transfer_id text null,
  receipt_url text null,
  created_at timestamptz not null default now(),
  paid_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='requests') then
    alter table public.payouts add constraint payouts_request_id_fkey foreign key (request_id) references public.requests(id) on delete set null;
  end if;
exception when others then null; end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='agreements') then
    alter table public.payouts add constraint payouts_agreement_id_fkey foreign key (agreement_id) references public.agreements(id) on delete set null;
  end if;
exception when others then null; end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='professionals') then
    alter table public.payouts add constraint payouts_professional_id_fkey foreign key (professional_id) references public.professionals(id) on delete cascade;
  end if;
exception when others then null; end $$;

create index if not exists payouts_status_idx on public.payouts(status);
create index if not exists payouts_created_at_idx on public.payouts(created_at);
create index if not exists payouts_professional_id_idx on public.payouts(professional_id);
create unique index if not exists payouts_request_prof_unique on public.payouts(request_id, professional_id) where request_id is not null and status <> 'canceled';

alter table public.payouts enable row level security;
do $$ begin create policy payouts_admin_read on public.payouts for select using (public.is_admin_jwt()); exception when duplicate_object then null; end $$;
do $$ begin create policy payouts_admin_insert on public.payouts for insert with check (public.is_admin_jwt()); exception when duplicate_object then null; end $$;
do $$ begin create policy payouts_admin_update on public.payouts for update using (public.is_admin_jwt()) with check (public.is_admin_jwt()); exception when duplicate_object then null; end $$;
do $$ begin create policy payouts_admin_delete on public.payouts for delete using (public.is_admin_jwt()); exception when duplicate_object then null; end $$;
