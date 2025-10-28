-- Fix linter warning: function_search_path_mutable for public.has_confirmed_bank_account
-- Sets an explicit, safe search_path for the helper function

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER FUNCTION public.has_confirmed_bank_account(uuid) SET search_path = pg_catalog, public';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Function public.has_confirmed_bank_account(uuid) not found, skipping.';
  END;
END$$;

