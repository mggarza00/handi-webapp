-- Simple index to speed up aggregates by professional_id
create index if not exists idx_reviews_prof_only on public.reviews (professional_id);

