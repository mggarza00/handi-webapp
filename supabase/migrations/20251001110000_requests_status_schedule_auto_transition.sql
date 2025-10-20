-- Normalize request statuses, add scheduling + auto-transition, and update dependent policies/views
begin;

-- 1) Data normalization for existing rows
update public.requests set status = 'finished' where status = 'completed';
update public.requests set status = 'canceled' where status in ('cancelled');

-- 2) Update CHECK constraint on requests.status to the new allowed values
do $$
declare
  v_conname text;
begin
  select c.conname into v_conname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'requests'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%status%check%';
  if v_conname is not null then
    execute format('alter table public.requests drop constraint %I', v_conname);
  end if;
end $$;

alter table public.requests
  add constraint requests_status_check
  check (status in ('active','scheduled','in_process','finished','canceled'));

-- 3) Scheduling and auto-transition columns on requests
alter table public.requests
  add column if not exists scheduled_date date,
  add column if not exists scheduled_time time without time zone,
  add column if not exists auto_in_process_at timestamptz,
  add column if not exists auto_transition_enabled boolean not null default true;

-- Helpful index for the auto-transition sweep
create index if not exists ix_requests_scheduled_auto
  on public.requests (auto_in_process_at)
  where status = 'scheduled' and auto_transition_enabled = true and auto_in_process_at is not null;

-- 4) Trigger to compute auto_in_process_at based on scheduled_date/time (08:00 if time is null)
create or replace function public.fn_requests_set_auto_time()
returns trigger
language plpgsql as $$
begin
  if new.scheduled_date is not null then
    new.auto_in_process_at := (new.scheduled_date + coalesce(new.scheduled_time, time '08:00:00'))::timestamptz;
  else
    new.auto_in_process_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_set_auto_time on public.requests;
create trigger trg_requests_set_auto_time
before insert or update of scheduled_date, scheduled_time on public.requests
for each row execute function public.fn_requests_set_auto_time();

-- 5) Background job to auto-transition scheduled -> in_process at the computed time
create or replace function public.requests_auto_in_process()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.requests
  set status = 'in_process'
  where status = 'scheduled'
    and coalesce(auto_transition_enabled, true) = true
    and auto_in_process_at is not null
    and auto_in_process_at <= now();
end;
$$;

-- Ensure pg_cron is available and schedule the job every 5 minutes
create extension if not exists pg_cron with schema extensions;

-- Unschedule previous job if present
select cron.unschedule(jobid)
from cron.job
where jobname = 'requests_auto_in_process';

-- Run every 5 minutes
select cron.schedule(
  'requests_auto_in_process',
  '*/5 * * * *',
  'select public.requests_auto_in_process();'
);

-- 6) Update policies and views that relied on old statuses

-- Reviews insert policy: require request finished (was completed)
drop policy if exists reviews_insert_client_completed on public.reviews;
drop policy if exists reviews_insert_client_finished on public.reviews;
create policy reviews_insert_client_finished on public.reviews
  for insert
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.requests r
      where r.id = request_id
        and r.created_by = auth.uid()
        and r.status = 'finished'
    )
    and exists (
      select 1 from public.agreements a
      where a.request_id = request_id
        and a.professional_id = professional_id
    )
  );

-- Legacy ratings table policy: mirror the same condition (finished)
drop policy if exists ratings_insert_client_completed on public.ratings;
drop policy if exists ratings_insert_client_finished on public.ratings;
create policy ratings_insert_client_finished on public.ratings
  for insert
  with check (
    from_user_id = auth.uid()
    and exists (
      select 1 from public.requests r
      where r.id = request_id
        and r.created_by = auth.uid()
        and r.status = 'finished'
    )
    and exists (
      select 1 from public.agreements a
      where a.request_id = request_id
        and a.professional_id = to_user_id
    )
  );

-- Service photos: allow during in_process and after finished (was in_review/completed)
drop policy if exists service_photos_insert_own_with_valid_request on public.service_photos;
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
        and r.status in ('in_process','finished')
    )
  );

-- Update view to reflect finished (was completed)
create or replace view public.v_professional_jobs as
select
  req.id as request_id,
  req.title as request_title,
  coalesce(sp.professional_id, null) as professional_id,
  array_agg(coalesce(sp.url, sp.image_url) order by coalesce(sp.created_at, sp.uploaded_at) asc)
    filter (where coalesce(sp.url, sp.image_url) is not null) as photos
from public.requests req
left join public.service_photos sp on sp.request_id = req.id
where req.status = 'finished'
group by req.id, req.title, sp.professional_id;

commit;

