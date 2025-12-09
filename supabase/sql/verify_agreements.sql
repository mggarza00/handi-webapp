-- Verificación de esquema y RLS para public.agreements

-- Columnas de la tabla
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'agreements'
order by ordinal_position;

-- RLS habilitado en la tabla
select c.relname as table, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'agreements';

-- Policies existentes (nombre correcto: policyname)
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'agreements'
order by policyname;

-- Triggers en la tabla agreements
select t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'agreements' and not t.tgisinternal
order by t.tgname;

-- Función del trigger (tg_set_updated_at)
select n.nspname as schema,
       p.proname as function_name,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'tg_set_updated_at';

-- Índices de la tabla agreements
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'agreements'
order by indexname;
