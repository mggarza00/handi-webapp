-- Add conditions column to requests and GIN index for search
alter table public.requests
  add column if not exists conditions text not null default '';

-- Create a GIN index using to_tsvector over conditions text for fast search
create index if not exists idx_requests_conditions_gin
  on public.requests using GIN (to_tsvector('simple', coalesce(conditions, '')));

