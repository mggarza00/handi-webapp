-- Fix FK in pro_request_favorites: pro_id should reference professionals(id)
begin;

-- Drop existing FK to profiles if present
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints tc
    where tc.constraint_name = 'pro_request_favorites_pro_id_fkey'
      and tc.table_schema = 'public'
      and tc.table_name = 'pro_request_favorites'
  ) then
    alter table public.pro_request_favorites drop constraint pro_request_favorites_pro_id_fkey;
  end if;
end$$;

-- Add FK to professionals
alter table public.pro_request_favorites
  add constraint pro_request_favorites_pro_id_fkey
  foreign key (pro_id) references public.professionals(id) on delete cascade;

commit;

