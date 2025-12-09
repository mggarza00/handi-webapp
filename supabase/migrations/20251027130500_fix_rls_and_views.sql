-- Fix security_invoker on views and enable + policy RLS for receipts/*

-- 0) Optional: normalize misspelled view name if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'reciepts'
  ) THEN
    EXECUTE 'ALTER VIEW public.reciepts RENAME TO receipts_view';
  END IF;
END$$;

-- 1) Set security_invoker=true on the advisor-flagged views (skip if missing)

DO $$
DECLARE
  v text;
  views text[] := ARRAY[
    'public.receipts_view',                -- formerly public.reciepts (if it existed)
    'public.v_receipt_pdf',
    'public.professionals_with_profile',
    'public.v_customer_bank_accounts_masked',
    'public.v_kpi_funnel_last_30d',
    'public.v_kpi_today',
    'public.v_professional_jobs'
  ];
BEGIN
  FOREACH v IN ARRAY views LOOP
    BEGIN
      EXECUTE format('ALTER VIEW %s SET (security_invoker = true);', v);
    EXCEPTION WHEN undefined_table THEN
      -- ignore missing views
      NULL;
    END;
  END LOOP;
END$$;

-- NOTE: If KPI views must remain globally readable by backend only,
-- consider moving them to an internal schema and exposing via SECURITY DEFINER RPC.
-- (Left as a manual follow-up if desired.)

-- 2) Enable RLS on public.receipts and public.receipt_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'receipts' AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'Table public.receipts not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'receipt_items' AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'Table public.receipt_items not found';
  END IF;

  EXECUTE 'ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY';
END$$;

-- 3) Drop existing conflicting policies (idempotent)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('receipts', 'receipt_items')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END$$;

-- 4) Create policies depending on schema shape:
--    Variant A: receipts has (customer_profile_id, professional_profile_id) + profiles(user_id)
--    Variant B: receipts has (user_id) directly
DO $$
DECLARE
  has_customer bool;
  has_professional bool;
  has_user_id bool;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='receipts' AND column_name='customer_profile_id'
  ) INTO has_customer;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='receipts' AND column_name='professional_profile_id'
  ) INTO has_professional;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='receipts' AND column_name='user_id'
  ) INTO has_user_id;

  IF (has_customer AND has_professional) THEN
    -- Variant A policies
    EXECUTE $SQL$
    CREATE POLICY receipts_select_self
    ON public.receipts
    FOR SELECT TO authenticated
    USING (
      customer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR
      professional_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    );

    CREATE POLICY receipts_insert_customer
    ON public.receipts
    FOR INSERT TO authenticated
    WITH CHECK (
      customer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR
      professional_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    );

    CREATE POLICY receipts_update_self
    ON public.receipts
    FOR UPDATE TO authenticated
    USING (
      customer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR
      professional_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    WITH CHECK (
      customer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR
      professional_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    );
    $SQL$;

    -- receipt_items inherits via receipt_id
    EXECUTE $SQL$
    CREATE POLICY receipt_items_select_parent
    ON public.receipt_items
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_items.receipt_id
          AND (
            r.customer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
            OR
            r.professional_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          )
      )
    );

    CREATE POLICY receipt_items_insert_parent
    ON public.receipt_items
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_items.receipt_id
          AND (
            r.customer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
            OR
            r.professional_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          )
      )
    );

    CREATE POLICY receipt_items_update_parent
    ON public.receipt_items
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_items.receipt_id
          AND (
            r.customer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
            OR
            r.professional_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_items.receipt_id
          AND (
            r.customer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
            OR
            r.professional_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          )
      )
    );
    $SQL$;

  ELSIF (has_user_id) THEN
    -- Variant B policies
    EXECUTE $SQL$
    CREATE POLICY receipts_select_self_uid
    ON public.receipts
    FOR SELECT TO authenticated
    USING ( user_id = auth.uid() );

    CREATE POLICY receipts_insert_self_uid
    ON public.receipts
    FOR INSERT TO authenticated
    WITH CHECK ( user_id = auth.uid() );

    CREATE POLICY receipts_update_self_uid
    ON public.receipts
    FOR UPDATE TO authenticated
    USING ( user_id = auth.uid() )
    WITH CHECK ( user_id = auth.uid() );

    CREATE POLICY receipt_items_select_uid
    ON public.receipt_items
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_items.receipt_id
          AND r.user_id = auth.uid()
      )
    );

    CREATE POLICY receipt_items_insert_uid
    ON public.receipt_items
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_items.receipt_id
          AND r.user_id = auth.uid()
      )
    );

    CREATE POLICY receipt_items_update_uid
    ON public.receipt_items
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_items.receipt_id
          AND r.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.id = receipt_items.receipt_id
          AND r.user_id = auth.uid()
      )
    );
    $SQL$;

  ELSE
    RAISE NOTICE 'Neither Variant A nor B columns found on public.receipts. Expected (customer_profile_id & professional_profile_id) or (user_id). Skipping policy creation; RLS remains enabled (default deny).';
  END IF;
END$$;

-- 5) Tighten quick grants
REVOKE ALL ON TABLE public.receipts, public.receipt_items FROM anon;
-- Ensure authenticated can at least SELECT where policies allow
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- 6) Sanity hints (run manually):
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('receipts','receipt_items');
-- dv+ public.*
-- supabase db lint
