begin;

alter table if exists public.quotes
  add column if not exists details text;

with notes_by_quote as (
  select
    q.id as quote_id,
    btrim(m.payload->>'notes') as notes,
    row_number() over (
      partition by q.id
      order by m.created_at asc, m.id asc
    ) as rn
  from public.quotes q
  join public.messages m
    on m.message_type = 'quote'
   and (m.payload->>'quote_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   and (m.payload->>'quote_id')::uuid = q.id
  where coalesce(btrim(m.payload->>'notes'), '') <> ''
)
update public.quotes q
set details = nbq.notes
from notes_by_quote nbq
where nbq.rn = 1
  and q.id = nbq.quote_id
  and q.details is null;

commit;
