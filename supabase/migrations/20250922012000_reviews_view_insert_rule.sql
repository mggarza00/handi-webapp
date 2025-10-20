-- Allow inserts into public.reviews view by redirecting to public.ratings
begin;

create or replace function public.fn_reviews_insert_redirect()
returns trigger language plpgsql as $$
begin
  -- Expect NEW has: request_id, client_id, professional_id, rating, comment
  insert into public.ratings (request_id, from_user_id, to_user_id, stars, comment)
  values (NEW.request_id, NEW.client_id, NEW.professional_id, NEW.rating, NEW.comment);
  return null; -- view insert handled by trigger
end $$;

drop trigger if exists trg_reviews_insert on public.reviews;
create trigger trg_reviews_insert
  instead of insert on public.reviews
  for each row execute function public.fn_reviews_insert_redirect();

commit;

