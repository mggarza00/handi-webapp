begin;

-- 1) Normaliza cualquier valor legacy o inesperado en status
update public.requests
set status = case
  when status is null or btrim(status) = '' then 'active'
  when lower(btrim(status)) in ('active','activa','open','abierta') then 'active'
  when lower(btrim(status)) in ('scheduled','agendada','agendado','programada','programado') then 'scheduled'
  when lower(btrim(status)) in ('in_process','in process','processing','inprogress','en_proceso','en-proceso','en proceso') then 'in_process'
  when lower(btrim(status)) in ('finished','complete','completed','finalizada','finalizado','closed','cerrada','terminado','terminada') then 'finished'
  when lower(btrim(status)) in ('canceled','cancelled','cancelada','cancelado') then 'canceled'
  else 'active'
end;

-- 2) Elimina cualquier CHECK de status (nombre normal o personalizado)
alter table public.requests drop constraint if exists requests_status_check;
do $$
declare
  v_conname text;
begin
  select c.conname into v_conname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'requests'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%status%';
  if v_conname is not null then
    execute format('alter table public.requests drop constraint %I', v_conname);
  end if;
end $$;

-- 3) Recrea el CHECK con el catálogo final
do $$
begin
  begin
    alter table public.requests
      add constraint requests_status_check
      check (status in ('active','scheduled','in_process','finished','canceled'));
  exception when duplicate_object then
    null;
  end;
end $$;

commit;

