-- Políticas RLS ajustadas para reseñas y fotos de servicios, y policies de Storage
begin;

-- ========== RATINGS (reseñas) ==========
-- Restringe inserción: solo el cliente que creó la solicitud y cuando la solicitud está completada
drop policy if exists ratings_insert_by_participants on public.ratings;
create policy ratings_insert_client_completed on public.ratings
  for insert
  with check (
    from_user_id = auth.uid()
    and exists (
      select 1 from public.requests r
      where r.id = request_id
        and r.created_by = auth.uid()
        and r.status = 'completed'
    )
    and exists (
      select 1 from public.agreements a
      where a.request_id = request_id
        and a.professional_id = to_user_id
    )
  );

-- ========== SERVICE_PHOTOS ==========
-- Inserción: solo el profesional asignado a la solicitud y si la solicitud está en revisión o completada
drop policy if exists service_photos_insert_own_with_valid_offer on public.service_photos;
create policy service_photos_insert_own_with_valid_request on public.service_photos
  for insert
  with check (
    professional_id = auth.uid()
    and exists (
      select 1 from public.agreements a
      where a.id = offer_id
        and a.request_id = request_id
        and a.professional_id = auth.uid()
    )
    and exists (
      select 1 from public.requests r
      where r.id = request_id
        and r.status in ('in_review','completed')
    )
  );

-- ========== STORAGE (service-photos) ==========
-- Lectura pública de objetos del bucket service-photos
drop policy if exists service_photos_storage_public_read on storage.objects;
create policy service_photos_storage_public_read on storage.objects
  for select using (bucket_id = 'service-photos');

-- Escritura: solo el profesional dueño del prefijo en la ruta
-- Convención esperada: name = '<professional_id>/<resto>'
drop policy if exists service_photos_storage_write_own on storage.objects;
create policy service_photos_storage_write_own on storage.objects
  for insert
  with check (
    bucket_id = 'service-photos'
    and (auth.uid()::text = split_part(name, '/', 1))
  );

-- Update/Delete: solo dueño
drop policy if exists service_photos_storage_update_own on storage.objects;
create policy service_photos_storage_update_own on storage.objects
  for update using (
    bucket_id = 'service-photos' and (auth.uid()::text = split_part(name, '/', 1))
  );

drop policy if exists service_photos_storage_delete_own on storage.objects;
create policy service_photos_storage_delete_own on storage.objects
  for delete using (
    bucket_id = 'service-photos' and (auth.uid()::text = split_part(name, '/', 1))
  );

commit;

