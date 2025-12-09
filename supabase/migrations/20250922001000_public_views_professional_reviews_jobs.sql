-- Vistas de lectura para página pública de perfiles
begin;

-- Vista: reseñas con datos de cliente
create or replace view public.v_professional_reviews as
select
  r.id,
  r.professional_id,
  r.request_id,
  r.client_id,
  r.rating,
  r.comment,
  r.created_at,
  p.full_name as client_name,
  p.avatar_url as client_avatar
from public.reviews r
join public.profiles p on p.id = r.client_id;

-- Vista: trabajos realizados (solicitudes completadas) con fotos agregadas
-- Adaptada al esquema actual: service_photos.image_url y profesional almacenado en la tabla
create or replace view public.v_professional_jobs as
select
  req.id as request_id,
  req.title as request_title,
  coalesce(sp.professional_id, null) as professional_id,
  array_agg(sp.image_url order by sp.uploaded_at asc)
    filter (where sp.image_url is not null) as photos
from public.requests req
left join public.service_photos sp on sp.request_id = req.id
where req.status = 'completed'
group by req.id, req.title, sp.professional_id;

commit;

-- Permisos de lectura pública
grant select on public.v_professional_reviews to anon, authenticated;
grant select on public.v_professional_jobs to anon, authenticated;
