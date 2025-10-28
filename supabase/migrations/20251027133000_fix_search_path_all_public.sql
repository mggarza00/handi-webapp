-- Ensure all functions in public have an explicit search_path
-- This mitigates linter warning: function_search_path_mutable

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema,
           p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
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

