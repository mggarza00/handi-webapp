-- Ensure 'conditions' column exists on public.requests
alter table if exists public.requests
  add column if not exists conditions text not null default '';

-- Ask PostgREST to reload schema cache (no-op if privileges not granted)
do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then
  -- ignore if notify is not permitted
  null;
end $$;

