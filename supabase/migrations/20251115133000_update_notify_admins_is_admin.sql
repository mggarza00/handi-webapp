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
