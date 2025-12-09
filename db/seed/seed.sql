-- Seed minimal config and a few payments/logs for demo
insert into public.config (id, commission_client, commission_pro, vat)
values (1, 10, 5, 16)
on conflict (id) do update set commission_client=excluded.commission_client, commission_pro=excluded.commission_pro, vat=excluded.vat, updated_at=now();

insert into public.webhooks_log (provider, event, status_code)
values ('stripe','payment_intent.succeeded',200),('stripe','payment_intent.payment_failed',400),('supabase','user.updated',200);

insert into public.audit_log (action, entity, entity_id, meta)
values ('CONFIG_UPDATE','config','1','{"demo":true}'::jsonb);

