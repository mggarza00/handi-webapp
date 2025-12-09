-- Large seed for admin browsing (mock data)
-- NOTE: Run only in dev environments.

-- Seed config
insert into public.config (id, commission_client, commission_pro, vat)
values (1, 10, 5, 16)
on conflict (id) do update set commission_client=excluded.commission_client, commission_pro=excluded.commission_pro, vat=excluded.vat, updated_at=now();

-- Seed webhooks_log
insert into public.webhooks_log (provider, event, status_code, payload, created_at)
select
  (array['stripe','supabase','custom'])[1 + (random()*2)::int],
  (array['payment_intent.succeeded','payment_intent.payment_failed','checkout.session.completed','user.updated'])[1 + (random()*3)::int],
  (array[200,400,500])[1 + (random()*2)::int],
  jsonb_build_object('demo', true, 'idx', g.i),
  now() - (g.i||' minutes')::interval
from generate_series(1,1020) as g(i);

-- Seed payments
insert into public.payments (request_id, amount, fee, vat, currency, status, payment_intent_id, created_at)
select
  null,
  round(200 + random()*5000, 2),
  round(random()*200,2),
  round(random()*300,2),
  'MXN',
  (array['pending','paid','refunded','failed','canceled','disputed'])[1 + (random()*5)::int],
  concat('pi_', substr(md5(random()::text),1,12)),
  now() - (g.i||' minutes')::interval
from generate_series(1,1020) as g(i);

-- Seed audit_log
insert into public.audit_log (action, actor_id, entity, entity_id, meta, created_at)
select
  (array['SETTINGS_UPDATE','KYC_APPROVE','KYC_REJECT','PAYMENT_REFUND'])[1 + (random()*3)::int],
  null,
  (array['config','professional','payment'])[1 + (random()*2)::int],
  substr(md5(random()::text),1,8),
  jsonb_build_object('demo', true, 'i', g.i),
  now() - (g.i||' minutes')::interval
from generate_series(1,1020) as g(i);

-- Seed jobs (requires jobs table)
insert into public.jobs (request_id, professional_id, status, requested_at, scheduled_for, created_at)
select
  null,
  null,
  (array['published','offered','paid','scheduled','in_process','completed','rated','canceled_by_client','canceled_by_pro','refunded','disputed'])[1 + (random()*10)::int],
  now() - (g.i||' hours')::interval,
  case when random() > 0.5 then now() + ((g.i%72)||' hours')::interval else null end,
  now() - (g.i||' hours')::interval
from generate_series(1,1020) as g(i);

