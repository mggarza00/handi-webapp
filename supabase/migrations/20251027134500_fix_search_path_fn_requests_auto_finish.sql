-- Fix linter warning: function_search_path_mutable for public.fn_requests_auto_finish
-- Sets an explicit, safe search_path for the trigger/helper function

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER FUNCTION public.fn_requests_auto_finish() SET search_path = pg_catalog, public';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Function public.fn_requests_auto_finish() not found, skipping.';
  END;
END$$;

