-- Buckets necesarios
do $$
begin
  begin
    perform storage.create_bucket(
      id => 'profiles-gallery',
      name => 'profiles-gallery',
      public => true,
      file_size_limit => 10485760
    );
  exception when undefined_function then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('profiles-gallery', 'profiles-gallery', true, 10485760)
    on conflict (id) do update set
      name = excluded.name,
      public = excluded.public,
      file_size_limit = excluded.file_size_limit;
  end;

  begin
    perform storage.create_bucket(
      id => 'requests',
      name => 'requests',
      public => false,
      file_size_limit => 10485760
    );
  exception when undefined_function then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('requests', 'requests', false, 10485760)
    on conflict (id) do update set
      name = excluded.name,
      public = excluded.public,
      file_size_limit = excluded.file_size_limit;
  end;
end
$$;

--  Políticas para 'profiles-gallery'
-- Lectura pública (solo para este bucket)
drop policy if exists "public read profiles-gallery" on storage.objects;
create policy "public read profiles-gallery"
on storage.objects for select
using (bucket_id = 'profiles-gallery');

-- Subir solo a tu carpeta userId/*
drop policy if exists "user insert own folder profiles-gallery" on storage.objects;
create policy "user insert own folder profiles-gallery"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profiles-gallery'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Actualizar/Borrar solo tus archivos
drop policy if exists "user update own files profiles-gallery" on storage.objects;
create policy "user update own files profiles-gallery"
on storage.objects for update to authenticated
using (bucket_id = 'profiles-gallery' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'profiles-gallery' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "user delete own files profiles-gallery" on storage.objects;
create policy "user delete own files profiles-gallery"
on storage.objects for delete to authenticated
using (bucket_id = 'profiles-gallery' and split_part(name, '/', 1) = auth.uid()::text);

--  Políticas para 'requests' (privado: solo dueño y admins vía RLS app-side)
drop policy if exists "user insert own folder requests" on storage.objects;
create policy "user insert own folder requests"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'requests'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "user read own files requests" on storage.objects;
create policy "user read own files requests"
on storage.objects for select to authenticated
using (bucket_id = 'requests' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "user update own files requests" on storage.objects;
create policy "user update own files requests"
on storage.objects for update to authenticated
using (bucket_id = 'requests' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'requests' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "user delete own files requests" on storage.objects;
create policy "user delete own files requests"
on storage.objects for delete to authenticated
using (bucket_id = 'requests' and split_part(name, '/', 1) = auth.uid()::text);
