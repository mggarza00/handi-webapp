-- Example SQL usage under RLS for public.agreements
-- Assumes you run with an authenticated session so auth.uid() is set.

-- 1) Insert as requester (allowed if you created the request)
-- Replace values with real IDs
insert into public.agreements (request_id, professional_id, amount)
values ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 100);

-- 2) Insert as professional (allowed when professional_id = auth.uid())
insert into public.agreements (request_id, professional_id, amount)
values ('22222222-2222-2222-2222-222222222222', auth.uid(), 120);

-- 3) Update status (allowed to either party)
update public.agreements
set status = 'accepted'
where id = '33333333-3333-3333-3333-333333333333'
returning id, status, updated_at;

-- 4) Get visible agreements (RLS restricts rows to parties)
select id, request_id, professional_id, amount, status, created_at, updated_at
from public.agreements
order by created_at desc
limit 50;

-- 5) Join with requests metadata (requires compatible RLS on public.requests)
select a.id, a.status, a.created_at, r.id as request_id, r.created_by
from public.agreements a
join public.requests r on r.id = a.request_id
order by a.created_at desc
limit 50;

