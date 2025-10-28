-- 001_requests_status_flow.sql
-- Normaliza estados con enum y agrega columnas de agenda básicas
begin;

-- 1) Enum (si ya hay enum request_status, no recrear)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum ('active','scheduled','in_process','finished','canceled');
  end if;
end$$;

-- 1.1) Normaliza valores previos si existen inconsistencias (solo si status es text)
do $$
declare
  v_coltype regtype;
begin
  select atttypid::regtype into v_coltype
  from pg_attribute
  where attrelid = 'public.requests'::regclass
    and attname = 'status'
    and attnum > 0
    and not attisdropped;

  if v_coltype = 'text'::regtype then
    update public.requests set status = 'finished' where status in ('completed');
    update public.requests set status = 'canceled' where status in ('cancelled');
  end if;
end$$;

-- 1.2) Quita CHECK previo si existe y convierte columna a enum
do $$
declare
  v_conname text;
  v_coltype regtype;
begin
  -- drop cualquier CHECK sobre status
  for v_conname in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'requests'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%check%'
  loop
    execute format('alter table public.requests drop constraint %I', v_conname);
  end loop;

  -- tipo actual
  select atttypid::regtype into v_coltype
  from pg_attribute
  where attrelid = 'public.requests'::regclass
    and attname = 'status'
    and attnum > 0
    and not attisdropped;

  if v_coltype is distinct from 'public.request_status'::regtype then
    -- asegurar que todos los valores mapeen al enum o al menos a valores válidos
    update public.requests set status = 'active' where status not in ('active','scheduled','in_process','finished','canceled') or status is null;
    begin
      alter table public.requests alter column status type public.request_status using status::public.request_status;
    exception when others then
      -- si falla el cast (datos legacy), mantén tipo actual en local
      null;
    end;
    begin
      alter table public.requests alter column status set default 'active';
    exception when others then null; end;
    begin
      alter table public.requests alter column status set not null;
    exception when others then null; end;
  end if;
exception when others then
  -- tolera errores en local (p. ej. tipos/valores legacy)
  null;
end $$;

-- 2) Tabla requests: columnas para agenda/estados (omite las que ya existan)
alter table public.requests
  add column if not exists scheduled_date date,
  add column if not exists scheduled_time time,
  add column if not exists timezone text default 'America/Mexico_City',
  add column if not exists in_process_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists canceled_at timestamptz;

-- 3) Índices útiles
create index if not exists idx_requests_status on public.requests(status);
create index if not exists idx_requests_scheduled on public.requests(scheduled_date, scheduled_time);

-- 4) Asegurar consistencia básica (programado requiere fecha). Usa nombre estable para permitir idempotencia manual.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'requests' and c.conname = 'scheduled_requires_date'
  ) then
    alter table public.requests
      add constraint scheduled_requires_date
      check ((status <> 'scheduled') or (scheduled_date is not null));
  end if;
end $$;

commit;
