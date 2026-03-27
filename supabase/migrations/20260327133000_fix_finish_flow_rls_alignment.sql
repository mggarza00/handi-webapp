begin;

-- Align professional evidence uploads with the actual finish flow.
drop policy if exists service_photos_insert_own_with_valid_request on public.service_photos;
create policy service_photos_insert_own_with_valid_request on public.service_photos
  for insert
  to authenticated
  with check (
    professional_id = auth.uid()
    and exists (
      select 1
      from public.agreements a
      where a.id = offer_id
        and a.request_id = request_id
        and a.professional_id = auth.uid()
        and coalesce(a.status::text, '') in ('accepted', 'paid', 'in_progress', 'completed')
    )
    and exists (
      select 1
      from public.requests r
      where r.id = request_id
        and r.status::text in ('in_process', 'finished')
    )
  );

-- Allow reviews from the real request participants during the completion flow.
drop policy if exists ratings_insert_by_participants on public.ratings;
drop policy if exists ratings_insert_client_completed on public.ratings;
drop policy if exists ratings_insert_client_finished on public.ratings;
drop policy if exists ratings_insert_request_participants_on_finalize on public.ratings;
create policy ratings_insert_request_participants_on_finalize on public.ratings
  for insert
  to authenticated
  with check (
    from_user_id = auth.uid()
    and from_user_id <> to_user_id
    and exists (
      select 1
      from public.requests r
      where r.id = request_id
        and (
          (
            r.created_by = auth.uid()
            and (r.finalized_by_pro_at is not null or r.status::text = 'finished')
            and (
              coalesce(r.accepted_professional_id, r.professional_id) = to_user_id
              or exists (
                select 1
                from public.agreements a
                where a.request_id = r.id
                  and a.professional_id = to_user_id
                  and coalesce(a.status::text, '') in ('accepted', 'paid', 'in_progress', 'completed')
              )
            )
          )
          or
          (
            r.created_by = to_user_id
            and r.status::text in ('in_process', 'finished')
            and (
              coalesce(r.accepted_professional_id, r.professional_id) = auth.uid()
              or exists (
                select 1
                from public.agreements a
                where a.request_id = r.id
                  and a.professional_id = auth.uid()
                  and coalesce(a.status::text, '') in ('accepted', 'paid', 'in_progress', 'completed')
              )
            )
          )
        )
    )
  );

commit;
