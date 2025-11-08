-- Ensure professionals(id) references profiles(id) via FK (cascade)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='professionals')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'professionals'
        and c.conname = 'professionals_id_fk_profiles'
    ) then
      alter table public.professionals
        add constraint professionals_id_fk_profiles
        foreign key (id) references public.profiles(id) on delete cascade;
    end if;
  end if;
exception when others then null; end $$;

