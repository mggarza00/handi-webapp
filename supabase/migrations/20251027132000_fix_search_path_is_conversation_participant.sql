-- Fix linter warning: function_search_path_mutable for public.is_conversation_participant
-- Sets an explicit, safe search_path for the function used in RLS policies

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER FUNCTION public.is_conversation_participant(uuid) SET search_path = pg_catalog, public';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Function public.is_conversation_participant(uuid) not found, skipping.';
  END;
END$$;

