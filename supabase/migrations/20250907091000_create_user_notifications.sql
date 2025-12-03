-- Tabla de notificaciones in-app
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz default now()
);
alter table public.user_notifications enable row level security;

-- RLS: cada quien ve/actualiza solo las suyas
drop policy if exists "user_notifications.select.own" on public.user_notifications;
create policy "user_notifications.select.own" on public.user_notifications
for select using (auth.uid() = user_id);

drop policy if exists "user_notifications.update.own" on public.user_notifications;
create policy "user_notifications.update.own" on public.user_notifications
for update using (auth.uid() = user_id);

drop policy if exists "user_notifications.insert.self" on public.user_notifications;
create policy "user_notifications.insert.self" on public.user_notifications
for insert with check (auth.uid() = user_id);

-- Índices útiles
create index if not exists ix_user_notifications_user_created
  on public.user_notifications (user_id, created_at desc);
create index if not exists ix_user_notifications_unread
  on public.user_notifications (user_id, read_at);

-- Función helper para notificar a todos los admins (SECURITY DEFINER)
-- Usa perfiles con role='admin' o is_admin=true.
create or replace function public.notify_admins(
  _type text,
  _title text,
  _body text,
  _link text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_notifications (user_id, type, title, body, link)
  select distinct p.id, _type, _title, _body, _link
  from public.profiles p
  where coalesce(p.is_admin, false) = true
     or lower(coalesce(p.role, '')) = 'admin';
end;
$$;

grant execute on function public.notify_admins(text, text, text, text) to authenticated;
