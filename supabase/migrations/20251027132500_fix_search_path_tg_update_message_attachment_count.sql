-- Fix linter warning: function_search_path_mutable for public.tg_update_message_attachment_count
-- Sets an explicit, safe search_path for the trigger function

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER FUNCTION public.tg_update_message_attachment_count() SET search_path = pg_catalog, public';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Function public.tg_update_message_attachment_count() not found, skipping.';
  END;
END$$;

