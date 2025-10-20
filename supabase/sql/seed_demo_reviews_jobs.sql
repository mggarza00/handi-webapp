-- Seed de demo: 3 reseñas y 2 servicios completados con fotos
do $$
declare
  v_pro uuid;
  v_client uuid;
  v_req1 uuid;
  v_req2 uuid;
  v_req3 uuid;
  v_ag1 uuid;
  v_ag2 uuid;
  v_ag3 uuid;
begin
  select p.id into v_pro from public.professionals p order by p.created_at nulls last limit 1;
  if v_pro is null then
    raise notice 'No hay profesionales. Abortando seeds demo.';
    return;
  end if;

  select pr.id into v_client from public.profiles pr where pr.id <> v_pro limit 1;
  if v_client is null then
    raise notice 'No hay cliente disponible. Abortando seeds demo.';
    return;
  end if;

  -- Crear 3 requests completadas del cliente
  insert into public.requests (id, title, description, city, status, created_by, created_at)
  values
    (gen_random_uuid(), 'Pintura de living', 'Paredes y techo', 'CABA', 'completed', v_client, now()),
    (gen_random_uuid(), 'Arreglo eléctrico', 'Cambio de térmica', 'CABA', 'completed', v_client, now()),
    (gen_random_uuid(), 'Colocación de estantes', 'Dormitorio', 'CABA', 'completed', v_client, now())
  returning id into v_req1;

  select id into v_req2 from public.requests where created_by = v_client and id <> v_req1 order by created_at desc limit 1;
  select id into v_req3 from public.requests where created_by = v_client and id not in (v_req1, v_req2) order by created_at desc limit 1;

  -- Vincular agreements con el profesional
  insert into public.agreements (id, request_id, professional_id, status, created_at)
  values
    (gen_random_uuid(), v_req1, v_pro, 'completed', now()),
    (gen_random_uuid(), v_req2, v_pro, 'completed', now()),
    (gen_random_uuid(), v_req3, v_pro, 'completed', now())
  returning id into v_ag1;
  select id into v_ag2 from public.agreements where request_id = v_req2 and professional_id = v_pro limit 1;
  select id into v_ag3 from public.agreements where request_id = v_req3 and professional_id = v_pro limit 1;

  -- Fotos de servicio (2 requests, 3-5 fotos cada una)
  insert into public.service_photos (id, offer_id, request_id, professional_id, image_url, uploaded_at)
  values
    (gen_random_uuid(), v_ag1, v_req1, v_pro, 'https://picsum.photos/seed/h1/800/600', now()),
    (gen_random_uuid(), v_ag1, v_req1, v_pro, 'https://picsum.photos/seed/h2/800/600', now()),
    (gen_random_uuid(), v_ag1, v_req1, v_pro, 'https://picsum.photos/seed/h3/800/600', now()),
    (gen_random_uuid(), v_ag2, v_req2, v_pro, 'https://picsum.photos/seed/j1/800/600', now()),
    (gen_random_uuid(), v_ag2, v_req2, v_pro, 'https://picsum.photos/seed/j2/800/600', now());

  -- 3 reseñas del cliente al profesional (una por request)
  insert into public.ratings (id, request_id, from_user_id, to_user_id, stars, comment, created_at)
  values
    (gen_random_uuid(), v_req1, v_client, v_pro, 5, 'Excelente trabajo, prolijo y rápido.', now()),
    (gen_random_uuid(), v_req2, v_client, v_pro, 4, 'Muy bueno, a tiempo.', now()),
    (gen_random_uuid(), v_req3, v_client, v_pro, 5, 'Todo perfecto. Recomendado.', now())
  on conflict do nothing;
end $$;

