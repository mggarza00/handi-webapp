-- Elimina tabla legacy public.users no utilizada
begin;

-- Si existieran dependencias no deseadas, el CASCADE las quita; revisar el diff del esquema tras aplicar
DROP TABLE IF EXISTS public.users CASCADE;
DROP SEQUENCE IF EXISTS public.users_id_seq;

commit;
