-- Enable Realtime for chat tables (idempotent)
-- 1) Ensure replica identity FULL for UPDATE payloads
alter table if exists public.messages replica identity full;
alter table if exists public.message_attachments replica identity full;

-- 2) Add tables to supabase_realtime publication if not already there
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    begin
      alter publication supabase_realtime add table public.messages;
    exception when others then
      -- ignore (publication may not exist in local dev without Realtime)
      null;
    end;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_attachments'
  ) then
    begin
      alter publication supabase_realtime add table public.message_attachments;
    exception when others then
      null;
    end;
  end if;
end $$;

