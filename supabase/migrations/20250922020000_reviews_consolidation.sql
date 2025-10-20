-- Consolidation: make public.reviews the canonical table
begin;

-- Remove old insert redirector if present
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'trg_reviews_insert') then
    drop trigger if exists trg_reviews_insert on public.reviews;
  end if;
  if exists (select 1 from pg_proc where proname = 'fn_reviews_insert_redirect') then
    drop function if exists public.fn_reviews_insert_redirect();
  end if;
end $$;

-- Drop legacy view if it exists; we'll create a real table
drop view if exists public.reviews;

-- Canonical reviews table
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  request_id uuid not null references public.requests(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete restrict,
  rating int2 not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (request_id, client_id)
);

alter table public.reviews enable row level security;

-- Public read (for portfolio pages)
drop policy if exists reviews_select_public on public.reviews;
create policy reviews_select_public on public.reviews for select using (true);

-- Insert only by client owner of the request and request completed, and must match pro via agreements
drop policy if exists reviews_insert_client_completed on public.reviews;
create policy reviews_insert_client_completed on public.reviews
  for insert
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.requests r
      where r.id = request_id
        and r.created_by = auth.uid()
        and r.status = 'completed'
    )
    and exists (
      select 1 from public.agreements a
      where a.request_id = request_id
        and a.professional_id = professional_id
    )
  );

-- Indexes to support profile pagination/aggregates
create index if not exists idx_reviews_prof_created on public.reviews (professional_id, created_at desc, id);

-- Data migration from legacy ratings (client -> professional only)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'ratings') then
    insert into public.reviews (id, request_id, professional_id, client_id, rating, comment, created_at)
    select r.id, r.request_id, r.to_user_id, r.from_user_id, r.stars, r.comment, coalesce(r.created_at, now())
    from public.ratings r
    join public.requests req on req.id = r.request_id
    where req.created_by = r.from_user_id
    on conflict do nothing;
  end if;
end $$;

commit;

