-- Storage bucket for request photos (private)
insert into storage.buckets (id, name, public)
values ('requests-photos','requests-photos', false)
on conflict (id) do nothing;

-- Metadata table for uploaded photos
create table if not exists public.request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  path text not null,
  thumb_path text,
  size_bytes int8,
  width int,
  height int,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint fk_request foreign key (request_id) references public.requests(id) on delete cascade
);

-- Helpful indexes
create index if not exists idx_request_photos_request on public.request_photos(request_id);
create index if not exists idx_request_photos_created_at on public.request_photos(created_at);

-- RLS
alter table public.request_photos enable row level security;

-- Policies: owner of the request may insert/select. Adjust as needed for collaborators.
do $$ begin
  if not exists (select 1 from pg_policy where polname = 'insert-own-photo') then
    create policy "insert-own-photo"
      on public.request_photos for insert
      to authenticated
      with check (
        exists (
          select 1 from public.requests r
          where r.id = request_id and r.created_by = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policy where polname = 'select-own-request-photos') then
    create policy "select-own-request-photos"
      on public.request_photos for select
      to authenticated
      using (
        exists (
          select 1 from public.requests r
          where r.id = request_photos.request_id and r.created_by = auth.uid()
        )
      );
  end if;
end $$;

-- Storage policies (private bucket). Allow upload/read under own request folder.
-- Requires object name like 'request_id/filename'
do $$ begin
  if not exists (select 1 from pg_policy where polname = 'upload-own-request-photo') then
    create policy "upload-own-request-photo"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'requests-photos'
        and (storage.foldername(name)) in (
          select r.id::text from public.requests r where r.created_by = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policy where polname = 'read-own-request-photo') then
    create policy "read-own-request-photo"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'requests-photos'
        and (storage.foldername(name)) in (
          select r.id::text from public.requests r where r.created_by = auth.uid()
        )
      );
  end if;
end $$;
