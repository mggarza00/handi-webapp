-- Create pro_calendar_events table to back professional calendar
begin;

create table if not exists public.pro_calendar_events (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null unique references public.requests(id) on delete cascade,
  title text not null,
  scheduled_date date,
  scheduled_time time,
  status text not null default 'scheduled',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- helpful indexes
create index if not exists idx_pce_pro on public.pro_calendar_events(pro_id);
create index if not exists idx_pce_date_time on public.pro_calendar_events(scheduled_date, scheduled_time);

-- trigger to keep updated_at in sync
create or replace function public.tg_pce_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_updated_at_pro_calendar_events on public.pro_calendar_events;
create trigger set_updated_at_pro_calendar_events
before update on public.pro_calendar_events
for each row execute function public.tg_pce_set_updated_at();

commit;

