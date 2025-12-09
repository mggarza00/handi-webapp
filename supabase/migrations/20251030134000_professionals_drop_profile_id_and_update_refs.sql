-- Drop professionals.profile_id and update dependent refs/policies to use professionals.id
begin;

-- 1) Applications: drop legacy policies that reference professionals.profile_id (to free dependency)
drop policy if exists app_delete_own on public.applications;
drop policy if exists app_insert_self on public.applications;
drop policy if exists app_read on public.applications;
drop policy if exists app_update_own on public.applications;
drop policy if exists applications_by_professional on public.applications;
drop policy if exists applications_delete_by_professional on public.applications;
drop policy if exists applications_insert_self on public.applications;

-- 2) Professionals: drop dependent indexes/constraints/policies, then column
drop index if exists idx_professionals_profile;
drop index if exists uq_professionals_profile_id;

alter table if exists public.professionals
  drop constraint if exists fk_professionals_profile_id,
  drop constraint if exists professionals_profile_id_fkey;

-- Old policies that referenced profile_id
drop policy if exists pro_delete_own on public.professionals;
drop policy if exists pro_insert_self on public.professionals;
drop policy if exists pro_update_own on public.professionals;
drop policy if exists professionals_self_all on public.professionals;

-- Finally drop the column
alter table if exists public.professionals drop column if exists profile_id;

-- Recreate delete policy with id-based ownership (preserve behavior)
do $$ begin
  begin
    create policy pro_delete_own on public.professionals
      for delete to authenticated using (id = auth.uid());
  exception when duplicate_object then null;
  end;
end $$;

-- 3) Applications: recreate safe policies without depending on professionals.profile_id
create policy app_delete_own on public.applications
  for delete to authenticated using (professional_id = auth.uid());

create policy app_insert_self on public.applications
  for insert to authenticated with check (
    professional_id = auth.uid()
    and exists (
      select 1 from public.requests r
      where r.id = applications.request_id and r.status = 'active'
    )
  );

create policy app_read on public.applications
  for select to authenticated using (
    professional_id = auth.uid()
    or exists (
      select 1 from public.requests r
      where r.id = applications.request_id and r.created_by = auth.uid()
    )
  );

create policy app_update_own on public.applications
  for update to authenticated using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy applications_by_professional on public.applications
  for select using (professional_id = auth.uid());

create policy applications_delete_by_professional on public.applications
  for delete using (professional_id = auth.uid());

create policy applications_insert_self on public.applications
  for insert with check (professional_id = auth.uid());

commit;
