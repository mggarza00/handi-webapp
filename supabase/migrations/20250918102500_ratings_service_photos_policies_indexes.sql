-- RLS, constraints, indexes y triggers para ratings y service_photos
begin;

-- =========
-- RATINGS
-- =========

-- Evitar auto-calificarse
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_ratings_not_self'
  ) then
    alter table public.ratings
      add constraint chk_ratings_not_self
      check (from_user_id <> to_user_id);
  end if;
end $$;

-- Un rating por usuario emisor por solicitud (permite 2 por solicitud: cliente->pro y pro->cliente)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ux_ratings_request_from_user'
  ) then
    alter table public.ratings
      add constraint ux_ratings_request_from_user
      unique (request_id, from_user_id);
  end if;
end $$;

-- Índices útiles
create index if not exists ix_ratings_to_user on public.ratings (to_user_id);
create index if not exists ix_ratings_request on public.ratings (request_id);

-- RLS Policies (select público; insert solo participantes)
drop policy if exists ratings_select_public on public.ratings;
create policy ratings_select_public on public.ratings
  for select using (true);

drop policy if exists ratings_insert_by_participants on public.ratings;
create policy ratings_insert_by_participants on public.ratings
  for insert
  with check (
    -- debe ser el emisor autenticado
    from_user_id = auth.uid()
    and from_user_id <> to_user_id
    -- y ambas partes deben pertenecer a la solicitud (cliente y profesional con algún acuerdo)
    and exists (
      select 1
      from public.requests r
      where r.id = request_id
        and (
          -- caso: cliente califica al profesional
          (r.created_by = from_user_id and exists (
            select 1 from public.agreements a
            where a.request_id = request_id and a.professional_id = to_user_id
          ))
          or
          -- caso: profesional califica al cliente
          (r.created_by = to_user_id and exists (
            select 1 from public.agreements a
            where a.request_id = request_id and a.professional_id = from_user_id
          ))
        )
    )
  );

-- Permitir que el emisor borre su propio rating (opcional)
drop policy if exists ratings_delete_own on public.ratings;
create policy ratings_delete_own on public.ratings
  for delete using (from_user_id = auth.uid());

-- =========
-- SERVICE_PHOTOS
-- =========

-- Índices útiles
create index if not exists ix_service_photos_professional on public.service_photos (professional_id);
create index if not exists ix_service_photos_request on public.service_photos (request_id);
create index if not exists ix_service_photos_offer on public.service_photos (offer_id);

-- RLS policies: lectura pública (portafolio), escritura solo dueño y oferta válida
drop policy if exists service_photos_select_public on public.service_photos;
create policy service_photos_select_public on public.service_photos
  for select using (true);

drop policy if exists service_photos_insert_own_with_valid_offer on public.service_photos;
create policy service_photos_insert_own_with_valid_offer on public.service_photos
  for insert
  with check (
    professional_id = auth.uid()
    and exists (
      select 1 from public.agreements a
      where a.id = offer_id
        and a.request_id = request_id
        and a.professional_id = auth.uid()
    )
  );

drop policy if exists service_photos_update_own on public.service_photos;
create policy service_photos_update_own on public.service_photos
  for update using (professional_id = auth.uid());

drop policy if exists service_photos_delete_own on public.service_photos;
create policy service_photos_delete_own on public.service_photos
  for delete using (professional_id = auth.uid());

-- =========
-- TRIGGERS: mantener promedio en professionals/profiles
-- =========

create or replace function public.recalc_professional_rating(p_user_id uuid)
returns void language plpgsql as $$
declare
  v_avg numeric;
begin
  select avg(stars)::numeric into v_avg from public.ratings where to_user_id = p_user_id;

  -- Actualiza tabla canonical de perfiles profesionales si existe
  update public.professionals p
    set rating = v_avg
  where p.id = p_user_id;

  -- Mantén compatibilidad con profiles.rating (si existe fila)
  update public.profiles pr
    set rating = v_avg
  where pr.id = p_user_id;
end $$;

create or replace function public.tg_ratings_recalc_professional()
returns trigger language plpgsql as $$
declare
  v_target uuid;
begin
  if tg_op = 'DELETE' then
    v_target := old.to_user_id;
  else
    v_target := new.to_user_id;
  end if;
  perform public.recalc_professional_rating(v_target);
  return null; -- AFTER trigger, no modifica fila
end $$;

drop trigger if exists ratings_recalc_after_insert on public.ratings;
create trigger ratings_recalc_after_insert
  after insert on public.ratings
  for each row execute function public.tg_ratings_recalc_professional();

drop trigger if exists ratings_recalc_after_update on public.ratings;
create trigger ratings_recalc_after_update
  after update of stars, to_user_id on public.ratings
  for each row execute function public.tg_ratings_recalc_professional();

drop trigger if exists ratings_recalc_after_delete on public.ratings;
create trigger ratings_recalc_after_delete
  after delete on public.ratings
  for each row execute function public.tg_ratings_recalc_professional();

commit;

