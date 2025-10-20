-- Bank accounts table for professionals + RLS + helper
-- Idempotent: creates objects only if missing; adjusts nothing else.

-- Tabla de cuentas bancarias del profesional
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  account_holder_name text not null,
  bank_name text,
  rfc text,
  clabe text not null,
  status text not null default 'pending' check (status in ('pending','confirmed','archived','rejected')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Solo 1 confirmada por perfil
create unique index if not exists uq_bank_accounts_one_confirmed
  on public.bank_accounts (profile_id) where (status = 'confirmed');

-- RLS
alter table public.bank_accounts enable row level security;

-- Policies (ajusta si profiles.id != auth.uid())
do $$
begin
  if not exists (select 1 from pg_policy where polname = 'bank_accounts_select_own' and polrelid = 'public.bank_accounts'::regclass) then
    create policy bank_accounts_select_own
    on public.bank_accounts for select to authenticated
    using (profile_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policy where polname = 'bank_accounts_insert_own' and polrelid = 'public.bank_accounts'::regclass) then
    create policy bank_accounts_insert_own
    on public.bank_accounts for insert to authenticated
    with check (profile_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policy where polname = 'bank_accounts_update_own' and polrelid = 'public.bank_accounts'::regclass) then
    create policy bank_accounts_update_own
    on public.bank_accounts for update to authenticated
    using (profile_id = auth.uid());
  end if;
end $$;

-- Helper: ¿tiene cuenta confirmada?
create or replace function public.has_confirmed_bank_account(uid uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.bank_accounts b
    where b.profile_id = uid and b.status = 'confirmed'
  );
$$;

