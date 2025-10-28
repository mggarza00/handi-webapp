-- Create compatibility view "public.reviews" if table does not exist.
-- It maps the existing "public.ratings" columns to the expected names.
DO $$
DECLARE
  has_reviews_table bool;
  -- check possible client column names in ratings
  col_client_profile bool;
  col_client_id bool;
  col_user_id bool;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='reviews'
  ) INTO has_reviews_table;

  IF has_reviews_table THEN
    -- Nothing to do: real table exists
    RETURN;
  END IF;

  -- Create/replace a compatibility view that maps ratings -> reviews shape
  -- ratings(from_user_id -> client_id, to_user_id -> professional_id, stars -> rating)
  EXECUTE $SQL$
    CREATE OR REPLACE VIEW public.reviews AS
    SELECT
      r.id,
      r.to_user_id   AS professional_id,
      r.request_id,
      r.from_user_id AS client_id,
      r.stars        AS rating,
      r.comment,
      r.created_at
    FROM public.ratings r;
  $SQL$;

  -- Basic grants, optional
  REVOKE ALL ON TABLE public.reviews FROM PUBLIC, anon;
  GRANT SELECT ON TABLE public.reviews TO authenticated;
END$$;
