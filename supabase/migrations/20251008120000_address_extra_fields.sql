begin;

alter table public.requests
  add column if not exists address_postcode text,
  add column if not exists address_state text,
  add column if not exists address_country text,
  add column if not exists address_context jsonb;

commit;

