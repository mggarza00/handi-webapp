alter table public.offers add column if not exists accepting_at timestamptz;
create index if not exists offers_accepting_idx on public.offers (id, accepting_at);
