begin;

alter table public.pro_calendar_events
  add column if not exists event_kind text not null default 'service';

alter table public.pro_calendar_events
  drop constraint if exists pro_calendar_events_event_kind_check;
alter table public.pro_calendar_events
  add constraint pro_calendar_events_event_kind_check
  check (event_kind in ('service', 'onsite_quote'));

update public.pro_calendar_events
set event_kind = 'onsite_quote'
where lower(coalesce(title, '')) like 'visita de cotizacion en sitio%';

alter table public.payouts
  add column if not exists payout_type text not null default 'service_offer';

alter table public.payouts
  drop constraint if exists payouts_payout_type_check;
alter table public.payouts
  add constraint payouts_payout_type_check
  check (payout_type in ('service_offer', 'onsite_quote'));

drop index if exists payouts_request_prof_unique;
create unique index if not exists payouts_request_prof_type_unique
on public.payouts(request_id, professional_id, payout_type)
where request_id is not null and status <> 'canceled';

commit;
