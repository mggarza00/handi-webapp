-- 0.1 Drop rule/trigger that inserted into ratings from views (defensive)
do $$ begin
  begin
    execute 'drop rule if exists reviews_view_insert on public.v_professional_reviews';
  exception when undefined_object then null; end;
  begin
    if exists (select 1 from pg_trigger where tgname = 'trg_reviews_insert') then
      drop trigger if exists trg_reviews_insert on public.reviews;
    end if;
  exception when undefined_object then null; end;
  begin
    drop function if exists public.fn_reviews_insert_redirect();
  exception when undefined_function then null; end;
end $$;

-- 0.2 If ratings table exists, migrate data into reviews and create compat view
do $$
declare
  has_ratings bool;
  has_rating_col bool;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='ratings'
  ) into has_ratings;
  if has_ratings then
    select exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='ratings' and column_name='rating'
    ) into has_rating_col;

    if has_rating_col then
      insert into public.reviews (professional_id, request_id, client_id, rating, comment, created_at)
      select r.to_user_id as professional_id,
             r.request_id,
             r.from_user_id as client_id,
             (r.rating)::int2,
             r.comment,
             coalesce(r.created_at, now())
      from public.ratings r
      left join public.reviews rv
        on rv.request_id = r.request_id and rv.client_id = r.from_user_id
      where rv.id is null;
    else
      insert into public.reviews (professional_id, request_id, client_id, rating, comment, created_at)
      select r.to_user_id as professional_id,
             r.request_id,
             r.from_user_id as client_id,
             (r.stars)::int2,
             r.comment,
             coalesce(r.created_at, now())
      from public.ratings r
      left join public.reviews rv
        on rv.request_id = r.request_id and rv.client_id = r.from_user_id
      where rv.id is null;
    end if;

    drop view if exists public.v_ratings_compat;
    create or replace view public.v_ratings_compat as
    select
      id,
      client_id      as from_user_id,
      professional_id as to_user_id,
      request_id,
      rating::int    as rating,
      comment,
      created_at
    from public.reviews;
  end if;
end $$;

