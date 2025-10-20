create table if not exists public.api_events (
  id bigserial primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists api_events_user_action_idx on public.api_events (user_id, action, created_at desc);
alter table public.api_events enable row level security;
drop policy if exists api_events_user_only on public.api_events;
create policy api_events_user_only on public.api_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
