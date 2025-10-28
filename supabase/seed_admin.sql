-- Seed de demo para admin: audit y webhooks
insert into public.audit_log (action, actor_id, meta)
values
  ('CONFIG_UPDATE', null, '{"demo":true}'),
  ('KYC_APPROVE', null, '{"pro_id":"11111111-1111-1111-1111-111111111111"}'),
  ('PAYMENT_REFUND', null, '{"payment_id":"pi_demo"}');

insert into public.webhook_events (provider, event, status, payload)
values
  ('stripe', 'payment_intent.succeeded', 'ok', '{"amount":1200}'),
  ('stripe', 'payment_intent.payment_failed', 'error', '{"amount":500}'),
  ('supabase', 'user.updated', 'ok', '{"role":"admin"}');

