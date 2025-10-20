-- Add applications.note column if missing
begin;

alter table public.applications
  add column if not exists note text;

commit;

