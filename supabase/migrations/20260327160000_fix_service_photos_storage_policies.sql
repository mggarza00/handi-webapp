begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'service-photos',
  'service-photos',
  true,
  (10 * 1024 * 1024)::bigint,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists service_photos_storage_public_read on storage.objects;
drop policy if exists service_photos_storage_write_own on storage.objects;

create policy service_photos_storage_public_read
on storage.objects
for select
using (bucket_id = 'service-photos');

create policy service_photos_storage_write_own
on storage.objects
for insert
with check (
  bucket_id = 'service-photos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

commit;
