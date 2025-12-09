-- Reviews view mapped from ratings to avoid duplication
-- This creates a read-only view `public.reviews` that exposes
-- client/pro roles derived from requests and ratings.

begin;

-- If reviews already exists as a table, keep it and skip creating a view
do $$
declare
  is_table bool;
begin
  select exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'reviews'
  ) into is_table;

  if is_table then
    return; -- keep table definition from consolidation
  end if;

  execute $V$
    create or replace view public.reviews as
    select
      r.id::uuid as id,
      r.request_id::uuid as request_id,
      case when req.created_by = r.from_user_id then r.to_user_id else r.from_user_id end as professional_id,
      req.created_by as client_id,
      case when req.created_by = r.from_user_id then 'client' else 'pro' end as reviewer_role,
      r.stars::int as rating,
      r.comment,
      r.created_at
    from public.ratings r
    join public.requests req on req.id = r.request_id;
  $V$;
end $$;

commit;
