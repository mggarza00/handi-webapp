-- Fix linter warning: function_search_path_mutable for public.set_updated_at
-- Sets an explicit, safe search_path for the trigger function

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Function public.set_updated_at() not found, skipping.';
  END;
END$$;

