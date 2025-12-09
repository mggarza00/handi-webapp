-- Fix linter warning: function_search_path_mutable for public.recalc_professional_rating
-- Sets an explicit, safe search_path for the helper function

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER FUNCTION public.recalc_professional_rating(uuid) SET search_path = pg_catalog, public';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Function public.recalc_professional_rating(uuid) not found, skipping.';
  END;
END$$;

