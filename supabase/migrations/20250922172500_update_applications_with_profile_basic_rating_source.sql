-- Update function get_applications_with_profile_basic to source pro_rating from profiles.rating
begin;

create or replace function public.get_applications_with_profile_basic(p_request_id uuid)
returns table (
  id uuid,
  note text,
  status text,
  created_at timestamptz,
  professional_id uuid,
  pro_full_name text,
  pro_rating numeric,
  pro_headline text
)
language sql
security definer
set search_path = public
as $$
  select a.id,
         null::text as note,
         a.status,
         a.created_at,
         a.professional_id,
         p.full_name as pro_full_name,
         pr.rating as pro_rating,
         p.headline as pro_headline
  from public.applications a
  join public.requests r on r.id = a.request_id
  join public.professionals p on p.id = a.professional_id
  left join public.profiles pr on pr.id = p.id
  where a.request_id = p_request_id
    and (
      a.professional_id = auth.uid()
      or r.created_by = auth.uid()
    );
$$;

revoke all on function public.get_applications_with_profile_basic(uuid) from public;
grant execute on function public.get_applications_with_profile_basic(uuid) to anon, authenticated;

commit;
