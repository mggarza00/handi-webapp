-- Adds missing request_id to offers and FK to requests(id)
alter table public.offers
  add column if not exists request_id uuid;

-- Populate from conversations when possible (optional, safe no-op if empty)
update public.offers o
set request_id = c.request_id
from public.conversations c
where o.conversation_id = c.id
  and o.request_id is null
  and c.request_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'offers_request_id_fkey'
      and connamespace = 'public'::regnamespace
  ) then
    alter table public.offers
      add constraint offers_request_id_fkey
      foreign key (request_id) references public.requests(id) on delete set null;
  end if;
end$$;

create index if not exists idx_offers_request on public.offers(request_id);
