-- Storage buckets and RLS policies for requests and profiles-gallery
-- This migration assumes Supabase default schema for storage (storage.objects)

-- Create buckets if not exist
-- requests: public READ (Option B), images up to 5MB
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'requests') then
    begin
      perform storage.create_bucket(
        id => 'requests'::text,
        name => 'requests'::text,
        public => true,
        file_size_limit => 5242880::bigint,
        allowed_mime_types => ARRAY['image/*']::text[]
      );
    exception when undefined_function then
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('requests', 'requests', true, 5242880::bigint, ARRAY['image/*']::text[])
      on conflict (id) do update set
        name = excluded.name,
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
    end;
  end if;

  if not exists (select 1 from storage.buckets where id = 'profiles-gallery') then
    begin
      perform storage.create_bucket(
        id => 'profiles-gallery'::text,
        name => 'profiles-gallery'::text,
        public => false,
        file_size_limit => 5242880::bigint,
        allowed_mime_types => ARRAY['image/*']::text[]
      );
    exception when undefined_function then
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('profiles-gallery', 'profiles-gallery', false, 5242880::bigint, ARRAY['image/*']::text[])
      on conflict (id) do update set
        name = excluded.name,
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
    end;
  end if;
end
$$;

-- Policies for storage.objects
-- Notes:
--  - name stores the full path (we enforce prefix "<uid>/...")
--  - owner is set automatically to auth.uid() by Supabase when uploading with signed auth
--  - auth.role() returns 'authenticated' or 'anon'

-- Clean existing policies for idempotency (safe if not present)
do $$ begin
  if exists (select 1 from pg_policy where polname = 'requests_select_public') then
    drop policy "requests_select_public" on storage.objects;
  end if;
  if exists (select 1 from pg_policy where polname = 'requests_insert_prefix') then
    drop policy "requests_insert_prefix" on storage.objects;
  end if;
  if exists (select 1 from pg_policy where polname = 'profiles_gallery_select_private') then
    drop policy "profiles_gallery_select_private" on storage.objects;
  end if;
  if exists (select 1 from pg_policy where polname = 'profiles_gallery_insert_own_prefix') then
    drop policy "profiles_gallery_insert_own_prefix" on storage.objects;
  end if;
  if exists (select 1 from pg_policy where polname = 'profiles_gallery_delete_own_prefix') then
    drop policy "profiles_gallery_delete_own_prefix" on storage.objects;
  end if;
end $$;

-- requests: public read (Option B for V1)
create policy "requests_select_public" on storage.objects
  for select
  using (bucket_id = 'requests');

-- requests: writes restricted to prefix
create policy "requests_insert_prefix" on storage.objects
  for insert
  with check (
    bucket_id = 'requests'
    and (
      -- authenticated users write under their own prefix
      (auth.role() = 'authenticated' and owner = auth.uid() and name like auth.uid()::text || '/%')
      -- optionally allow anon uploads under 'anon/' prefix (comment out to disable)
      or (auth.role() = 'anon' and name like 'anon/%')
    )
  );

-- profiles-gallery: private; no public select (signed URLs bypass policies)
create policy "profiles_gallery_select_private" on storage.objects
  for select
  using (false);

-- profiles-gallery: allow owners to insert under their own prefix
create policy "profiles_gallery_insert_own_prefix" on storage.objects
  for insert
  with check (
    bucket_id = 'profiles-gallery'
    and auth.role() = 'authenticated'
    and owner = auth.uid()
    and name like auth.uid()::text || '/%'
  );

-- profiles-gallery: allow owners to delete under their own prefix
create policy "profiles_gallery_delete_own_prefix" on storage.objects
  for delete
  using (
    bucket_id = 'profiles-gallery'
    and auth.role() = 'authenticated'
    and owner = auth.uid()
    and name like auth.uid()::text || '/%'
  );

-- Optional (tighten): prevent updates except metadata
-- create policy "profiles_gallery_update_metadata_only" on storage.objects
--   for update using (false);

-- Guidance: For a stricter setup, make 'requests' private as well and rely on signed URLs.
-- In that case, replace requests_select_public with a false policy and adjust the code to use createSignedUrl.

