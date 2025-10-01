-- Ensure message_attachments.conversation_id matches messages.conversation_id
-- Idempotent backfill + trigger

-- Backfill rows where conversation_id is null or incorrect
update public.message_attachments a
set conversation_id = m.conversation_id
from public.messages m
where a.message_id = m.id
  and (a.conversation_id is null or a.conversation_id <> m.conversation_id);

-- Trigger function to sync conversation_id on insert/update
create or replace function public.sync_attachment_conversation_id()
returns trigger
language plpgsql
as $$
begin
  if new.conversation_id is null then
    select m.conversation_id into new.conversation_id
    from public.messages m
    where m.id = new.message_id;
  end if;

  -- Force the correct conversation_id if it doesn't match
  if exists (
    select 1 from public.messages m
    where m.id = new.message_id and m.conversation_id <> new.conversation_id
  ) then
    select m.conversation_id into new.conversation_id
    from public.messages m
    where m.id = new.message_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_attachment_conversation_id on public.message_attachments;
create trigger trg_sync_attachment_conversation_id
before insert or update on public.message_attachments
for each row execute function public.sync_attachment_conversation_id();
