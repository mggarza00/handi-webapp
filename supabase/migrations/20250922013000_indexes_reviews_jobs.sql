-- Indexes to support pagination and filters
begin;

-- For reviews pagination by professional and created_at (map to ratings target)
create index if not exists idx_reviews_prof_created on public.ratings (to_user_id, created_at desc, id);

-- For service photos by professional, request and uploaded time
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_service_photos_prof_req_created'
  ) then
    create index idx_service_photos_prof_req_created on public.service_photos (professional_id, request_id, uploaded_at desc, id);
  end if;
end $$;

-- Agreements index to support request/prof join
create index if not exists idx_agreements_request_prof on public.agreements (request_id, professional_id);

commit;
