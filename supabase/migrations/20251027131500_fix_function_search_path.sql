-- Harden SECURITY DEFINER functions by setting a safe search_path
-- Addresses advisor warning: Function Search Path Mutable

DO $$
DECLARE
  rec record;
BEGIN
  -- Set explicit search_path for SECURITY DEFINER functions in public schema
  -- Skips functions that already set search_path via proconfig
  FOR rec IN
    SELECT n.nspname AS schema,
           p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname = 'public'
      AND (
        p.proconfig IS NULL OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path%'
        )
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public;',
      rec.schema,
      rec.name,
      rec.args
    );
  END LOOP;
END$$;

