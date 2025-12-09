-- Create professionals-gallery bucket and RLS policies
begin;

-- Create bucket if not exists
-- Use a widely compatible signature (id, public)
-- Fallback: insert into storage.buckets if create_bucket function isn't available
insert into storage.buckets (id, name, public)
select 'professionals-gallery', 'professionals-gallery', false
where not exists (select 1 from storage.buckets where id = 'professionals-gallery');

-- Drop old policies if present
do $$ begin
  if exists (select 1 from pg_policy where polname = 'professionals_gallery_select_private') then
    drop policy "professionals_gallery_select_private" on storage.objects;
  end if;
  if exists (select 1 from pg_policy where polname = 'professionals_gallery_insert_own_prefix') then
    drop policy "professionals_gallery_insert_own_prefix" on storage.objects;
  end if;
  if exists (select 1 from pg_policy where polname = 'professionals_gallery_delete_own_prefix') then
    drop policy "professionals_gallery_delete_own_prefix" on storage.objects;
  end if;
end $$;

-- Private read (use signed URLs)
create policy "professionals_gallery_select_private" on storage.objects
  for select
  using (false);

-- Owners can insert under their own prefix
create policy "professionals_gallery_insert_own_prefix" on storage.objects
  for insert
  with check (
    bucket_id = 'professionals-gallery'
    and auth.role() = 'authenticated'
    and owner = auth.uid()
    and name like auth.uid()::text || '/%'
  );

-- Owners can delete under their own prefix
create policy "professionals_gallery_delete_own_prefix" on storage.objects
  for delete
  using (
    bucket_id = 'professionals-gallery'
    and auth.role() = 'authenticated'
    and owner = auth.uid()
    and name like auth.uid()::text || '/%'
  );

commit;
