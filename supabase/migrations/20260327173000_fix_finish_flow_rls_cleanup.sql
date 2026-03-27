begin;

drop policy if exists requests_select_assigned_professional_finish_flow on public.requests;

drop policy if exists service_photos_insert_own_with_valid_request on public.service_photos;
create policy service_photos_insert_own_with_valid_request on public.service_photos
  for insert
  with check (
    professional_id = auth.uid()
    and exists (
      select 1
      from public.agreements a
      where a.id = service_photos.offer_id
        and a.request_id = service_photos.request_id
        and a.professional_id = auth.uid()
        and coalesce(a.status::text, '') in ('accepted', 'paid', 'in_progress', 'completed')
    )
    and exists (
      select 1
      from public.requests r
      where r.id = service_photos.request_id
        and r.status::text in ('in_process', 'finished')
    )
  );

commit;
