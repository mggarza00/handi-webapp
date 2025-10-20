-- RLS end-to-end test (Supabase SQL Editor friendly)
-- Replace the placeholders below with existing IDs from your project
-- before running. The script runs inside a transaction and rolls back.

-- PLACEHOLDERS TO REPLACE:
--   {{REQUESTER_ID}}       -- a valid auth.users.id who created the request
--   {{PROFESSIONAL_ID}}    -- a valid auth.users.id of the professional
--   {{REQUEST_ID}}         -- a valid public.requests.id whose created_by = {{REQUESTER_ID}}

begin;

-- Simulate requester session
set local role authenticated;
set local "request.jwt.claim.sub" = '{{REQUESTER_ID}}';
select 'requester_auth_uid' as label, auth.uid();

-- Try INSERT as requester (allowed if requester created the request)
with ins as (
  insert into public.agreements (request_id, professional_id, amount, status)
  values ('{{REQUEST_ID}}'::uuid, '{{PROFESSIONAL_ID}}'::uuid, 100, 'negotiating')
  returning *
)
select 'inserted_as_requester' as label, id, request_id, professional_id, status, created_at from ins;

-- Capture the latest agreement for this pair and update as professional
-- Simulate professional session
set local "request.jwt.claim.sub" = '{{PROFESSIONAL_ID}}';
select 'professional_auth_uid' as label, auth.uid();

update public.agreements a
set status = 'accepted'
where a.id in (
  select id from public.agreements
  where request_id = '{{REQUEST_ID}}'::uuid and professional_id = '{{PROFESSIONAL_ID}}'::uuid
  order by created_at desc
  limit 1
)
returning 'updated_as_professional' as label, id, status;

-- Verify visibility as professional
select 'select_as_professional' as label, id, status
from public.agreements
where request_id = '{{REQUEST_ID}}'::uuid and professional_id = '{{PROFESSIONAL_ID}}'::uuid
order by created_at desc
limit 1;

-- Cleanup: rollback so the test doesn't persist data
rollback;

-- Optional: quick view of policies and indexes
select policyname, cmd from pg_policies where schemaname='public' and tablename='agreements' order by policyname;
select indexname from pg_indexes where schemaname='public' and tablename='agreements' order by indexname;

