-- Copied from 20251022_jobs_and_prof_kyc.sql with ordering fix
-- Jobs lifecycle + professionals KYC status
create extension if not exists pgcrypto;

do $$ begin
  create type public.job_status as enum (
    'published','offered','paid','scheduled','in_process','completed','rated','canceled_by_client','canceled_by_pro','refunded','disputed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  professional_id uuid null,
  status public.job_status not null default 'published',
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz null,
  paid_at timestamptz null,
  rated_at timestamptz null,
  canceled_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='requests') then
    alter table public.jobs add constraint jobs_request_id_fkey foreign key (request_id) references public.requests(id) on delete cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    alter table public.jobs add constraint jobs_professional_id_fkey foreign key (professional_id) references public.profiles(id) on delete set null;
  end if;
exception when others then null; end $$;

create index if not exists jobs_request_id_idx on public.jobs(request_id);
create index if not exists jobs_professional_id_idx on public.jobs(professional_id);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_scheduled_for_idx on public.jobs(scheduled_for);

-- updated_at trigger intentionally omitted if helper not present

alter table public.jobs enable row level security;
do $$ begin create policy jobs_admin_read on public.jobs for select using (public.is_admin_jwt()); exception when duplicate_object then null; end $$;
do $$ begin create policy jobs_admin_insert on public.jobs for insert with check (public.is_admin_jwt()); exception when duplicate_object then null; end $$;
do $$ begin create policy jobs_admin_update on public.jobs for update using (public.is_admin_jwt()) with check (public.is_admin_jwt()); exception when duplicate_object then null; end $$;
do $$ begin create policy jobs_admin_delete on public.jobs for delete using (public.is_admin_jwt()); exception when duplicate_object then null; end $$;

create or replace view public.v_kpi_funnel_last_30d as
select status::text as status, count(*)::int as cnt
from public.jobs
where requested_at >= now() - interval '30 days'
group by status
order by status;

do $$ begin
  create type public.kyc_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='professionals') then
    alter table public.professionals add column if not exists kyc_status public.kyc_status not null default 'pending';
  end if;
end $$;
