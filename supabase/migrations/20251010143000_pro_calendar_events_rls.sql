-- RLS policies for pro_calendar_events
begin;

alter table if exists public.pro_calendar_events enable row level security;

-- Select: solo el profesional dueño del evento
drop policy if exists "pce.select.own" on public.pro_calendar_events;
create policy "pce.select.own" on public.pro_calendar_events
for select using (pro_id = auth.uid());

-- Opcional: si deseas permitir que el pro actualice estado de sus eventos (normalmente lo hará backend SRK)
drop policy if exists "pce.update.own" on public.pro_calendar_events;
create policy "pce.update.own" on public.pro_calendar_events
for update using (pro_id = auth.uid());

commit;

