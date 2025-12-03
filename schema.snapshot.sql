

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."ApplicationStatus" AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


ALTER TYPE "public"."ApplicationStatus" OWNER TO "postgres";


CREATE TYPE "public"."RequestStatus" AS ENUM (
    'active',
    'closed'
);


ALTER TYPE "public"."RequestStatus" OWNER TO "postgres";


CREATE TYPE "public"."Role" AS ENUM (
    'contractor',
    'professional',
    'admin'
);


ALTER TYPE "public"."Role" OWNER TO "postgres";


CREATE TYPE "public"."offer_status" AS ENUM (
    'sent',
    'accepted',
    'rejected',
    'expired',
    'canceled',
    'paid'
);


ALTER TYPE "public"."offer_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_applications_with_profile_basic"("p_request_id" "uuid") RETURNS TABLE("id" "uuid", "note" "text", "status" "text", "created_at" timestamp with time zone, "professional_id" "uuid", "pro_full_name" "text", "pro_rating" numeric, "pro_headline" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select a.id,
         null::text as note,
         a.status,
         a.created_at,
         a.professional_id,
         p.full_name as pro_full_name,
         p.rating as pro_rating,
         p.headline as pro_headline
  from public.applications a
  join public.requests r on r.id = a.request_id
  join public.professionals p on p.id = a.professional_id
  where a.request_id = p_request_id
    and (
      a.professional_id = auth.uid()
      or r.created_by = auth.uid()
    );
$$;


ALTER FUNCTION "public"."get_applications_with_profile_basic"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_professionals_browse"("p_city" "text" DEFAULT NULL::"text", "p_category" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "full_name" "text", "headline" "text", "rating" numeric, "is_featured" boolean, "city" "text", "last_active_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.id,
         p.full_name,
         p.headline,
         p.rating,
         p.is_featured,
         p.city,
         p.last_active_at
  from public.professionals p
  where coalesce(p.active, true) = true
    and (p.last_active_at is null or p.last_active_at > now() - interval '21 days')
    and (p_city is null or p.city = p_city or exists (
          select 1 from jsonb_array_elements_text(coalesce(p.cities,'[]'::jsonb)) c(city)
          where c.city = p_city
        ))
    and (p_category is null or exists (
          select 1 from jsonb_array_elements(coalesce(p.categories, '[]'::jsonb)) pc
          where pc->>'name' = p_category
        ))
  order by p.is_featured desc nulls last,
           p.rating desc nulls last,
           p.last_active_at desc nulls last
  limit 200;
$$;


ALTER FUNCTION "public"."get_professionals_browse"("p_city" "text", "p_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_prospects_for_request"("p_request_id" "uuid") RETURNS TABLE("professional_id" "uuid", "full_name" "text", "headline" "text", "rating" numeric, "is_featured" boolean, "last_active_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  /* Matching and ranking rules per V1, now against professionals */
  select p.id as professional_id,
         p.full_name,
         p.headline,
         p.rating,
         p.is_featured,
         p.last_active_at
  from public.requests r
  join public.professionals p on true
  where r.id = p_request_id
    and r.created_by = auth.uid()
    and coalesce(p.active, true) = true
    and (
      p.city = r.city
      or exists (
        select 1 from jsonb_array_elements_text(coalesce(p.cities, '[]'::jsonb)) as c(city)
        where c.city = r.city
      )
    )
    and (
      r.category is null
      or exists (
        select 1 from jsonb_array_elements(coalesce(p.categories, '[]'::jsonb)) pc
        where pc->>'name' = r.category
      )
    )
    and (
      jsonb_array_length(coalesce(r.subcategories, '[]'::jsonb)) = 0
      or exists (
        select 1
        from jsonb_array_elements(coalesce(p.subcategories, '[]'::jsonb)) ps
        join jsonb_array_elements(coalesce(r.subcategories, '[]'::jsonb)) rs
          on (ps->>'name') = (rs->>'name')
      )
    )
  order by p.is_featured desc nulls last,
           p.rating desc nulls last,
           p.last_active_at desc nulls last
  limit 20;
$$;


ALTER FUNCTION "public"."get_prospects_for_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admins"("_type" "text", "_title" "text", "_body" "text", "_link" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.user_notifications (user_id, type, title, body, link)
  select distinct p.id, _type, _title, _body, _link
  from public.profiles p
  where coalesce(p.is_admin, false) = true
     or lower(coalesce(p.role, '')) = 'admin';
end;
$$;


ALTER FUNCTION "public"."notify_admins"("_type" "text", "_title" "text", "_body" "text", "_link" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_offer_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
    values (
      NEW.conversation_id,
      NEW.client_id,
      coalesce(NEW.title, 'Oferta enviada'),
      'offer',
      jsonb_build_object(
        'offer_id', NEW.id,
        'title', NEW.title,
        'description', NEW.description,
        'amount', NEW.amount,
        'currency', NEW.currency,
        'service_date', NEW.service_date,
        'status', NEW.status,
        'actions', case when NEW.status = 'sent' then jsonb_build_array('accept','reject') else jsonb_build_array() end
      ),
      now()
    );
    update public.conversations set last_message_at = now() where id = NEW.conversation_id;
    return NEW;
  elsif (TG_OP = 'UPDATE') then
    if NEW.status is distinct from OLD.status then
      if NEW.status = 'accepted' then
        insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
        values (
          NEW.conversation_id,
          NEW.professional_id,
          'Oferta aceptada',
          'system',
          jsonb_build_object(
            'offer_id', NEW.id,
            'status', NEW.status,
            'checkout_url', NEW.checkout_url
          ),
          now()
        );
        update public.conversations set last_message_at = now() where id = NEW.conversation_id;
      elsif NEW.status = 'rejected' then
        insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
        values (
          NEW.conversation_id,
          NEW.professional_id,
          case when coalesce(NEW.reject_reason, '') = '' then 'Oferta rechazada' else 'Oferta rechazada: ' || NEW.reject_reason end,
          'system',
          jsonb_build_object(
            'offer_id', NEW.id,
            'status', NEW.status,
            'reason', NEW.reject_reason
          ),
          now()
        );
        update public.conversations set last_message_at = now() where id = NEW.conversation_id;
      elsif NEW.status = 'paid' then
        insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
        values (
          NEW.conversation_id,
          NEW.client_id,
          'Pago recibido. ?Gracias!',
          'system',
          jsonb_build_object(
            'offer_id', NEW.id,
            'status', NEW.status
          ),
          now()
        );
        update public.conversations set last_message_at = now() where id = NEW.conversation_id;
      elsif NEW.status = 'canceled' then
        insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
        values (
          NEW.conversation_id,
          NEW.client_id,
          'Oferta cancelada',
          'system',
          jsonb_build_object(
            'offer_id', NEW.id,
            'status', NEW.status
          ),
          now()
        );
        update public.conversations set last_message_at = now() where id = NEW.conversation_id;
      elsif NEW.status = 'expired' then
        insert into public.messages (conversation_id, sender_id, body, message_type, payload, created_at)
        values (
          NEW.conversation_id,
          NEW.client_id,
          'Oferta expirada',
          'system',
          jsonb_build_object(
            'offer_id', NEW.id,
            'status', NEW.status
          ),
          now()
        );
        update public.conversations set last_message_at = now() where id = NEW.conversation_id;
      end if;
    end if;
    NEW.updated_at := now();
    return NEW;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."on_offer_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."tg_set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agreements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "amount" numeric,
    "status" "text" DEFAULT 'negotiating'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agreements_status_check" CHECK (("status" = ANY (ARRAY['negotiating'::"text", 'accepted'::"text", 'paid'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text", 'disputed'::"text"])))
);


ALTER TABLE "public"."agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid",
    "professional_id" "uuid",
    "cover_letter" "text",
    "proposed_budget" numeric(12,2),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories_subcategories" (
    "Categoría" "text" NOT NULL,
    "Subcategoría" "text" NOT NULL,
    "Descripción" "text",
    "Activa" "text",
    "Ícono" "text",
    "Tipo de servicio" "text",
    "Nivel de especialización" "text"
);


ALTER TABLE "public"."categories_subcategories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "pro_id" "uuid" NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid",
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid",
    "text" "text",
    "conversation_id" "uuid",
    "body" "text",
    "read_by" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "message_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "service_date" timestamp with time zone,
    "currency" "text" DEFAULT 'MXN'::"text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" "public"."offer_status" DEFAULT 'sent'::"public"."offer_status" NOT NULL,
    "reject_reason" "text",
    "checkout_url" "text",
    "payment_intent_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "offers_status_requires_client" CHECK (("client_id" = "created_by"))
);


ALTER TABLE "public"."offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pro_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "services_desc" "text" NOT NULL,
    "cities" "jsonb" NOT NULL,
    "categories" "jsonb" NOT NULL,
    "years_experience" integer NOT NULL,
    "refs" "jsonb" NOT NULL,
    "uploads" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "empresa" boolean DEFAULT false
);


ALTER TABLE "public"."pro_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professionals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "headline" "text",
    "skills" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "rating" numeric(3,2),
    "is_featured" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "active" boolean DEFAULT true,
    "full_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "years_experience" integer,
    "city" "text",
    "cities" "jsonb" DEFAULT '[]'::"jsonb",
    "categories" "jsonb" DEFAULT '[]'::"jsonb",
    "subcategories" "jsonb" DEFAULT '[]'::"jsonb",
    "last_active_at" timestamp with time zone,
    "empresa" boolean DEFAULT false
);


ALTER TABLE "public"."professionals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "name" "text",
    "role" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "headline" "text",
    "bio" "text",
    "years_experience" integer,
    "rating" numeric,
    "is_featured" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "city" "text",
    "cities" "jsonb" DEFAULT '[]'::"jsonb",
    "categories" "jsonb" DEFAULT '[]'::"jsonb",
    "subcategories" "jsonb" DEFAULT '[]'::"jsonb",
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "is_client_pro" boolean DEFAULT false,
    "is_admin" boolean DEFAULT false
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "stars" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ratings_stars_check" CHECK ((("stars" >= 1) AND ("stars" <= 5)))
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "city" "text",
    "category" "text",
    "subcategory" "text",
    "budget" numeric,
    "required_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subcategories" "jsonb" DEFAULT '[]'::"jsonb",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "requests_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."requests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."requests"."subcategories" IS 'Array JSON con subcategorías (ej. ["Plomería", {"name":"Instalación"}])';



COMMENT ON COLUMN "public"."requests"."attachments" IS 'Array JSON con adjuntos (url|path, mime, size)';



CREATE TABLE IF NOT EXISTS "public"."service_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "link" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_notifications" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_request_id_professional_id_key" UNIQUE ("request_id", "professional_id");



ALTER TABLE ONLY "public"."categories_subcategories"
    ADD CONSTRAINT "categories_subcategories_pkey" PRIMARY KEY ("Subcategoría");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_request_id_customer_id_pro_id_key" UNIQUE ("request_id", "customer_id", "pro_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pro_applications"
    ADD CONSTRAINT "pro_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_photos"
    ADD CONSTRAINT "service_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_applications_prof" ON "public"."applications" USING "btree" ("professional_id");



CREATE INDEX "idx_applications_req" ON "public"."applications" USING "btree" ("request_id");



CREATE INDEX "idx_conversations_customer" ON "public"."conversations" USING "btree" ("customer_id");



CREATE INDEX "idx_conversations_last" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_conversations_pro" ON "public"."conversations" USING "btree" ("pro_id");



CREATE INDEX "idx_conversations_request" ON "public"."conversations" USING "btree" ("request_id");



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created_ts" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "idx_offers_client_status" ON "public"."offers" USING "btree" ("client_id", "status");



CREATE INDEX "idx_offers_conversation_created" ON "public"."offers" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_offers_professional_status" ON "public"."offers" USING "btree" ("professional_id", "status");



CREATE INDEX "idx_pro_applications_empresa" ON "public"."pro_applications" USING "btree" ("empresa");



CREATE INDEX "idx_professionals_empresa" ON "public"."professionals" USING "btree" ("empresa");



CREATE INDEX "idx_professionals_profile" ON "public"."professionals" USING "btree" ("profile_id");



CREATE INDEX "idx_profiles_is_admin" ON "public"."profiles" USING "btree" ("is_admin");



CREATE INDEX "idx_profiles_is_client_pro" ON "public"."profiles" USING "btree" ("is_client_pro");



CREATE INDEX "idx_requests_cat_city" ON "public"."requests" USING "btree" ("category", "city");



CREATE INDEX "idx_requests_created_at" ON "public"."requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_requests_created_by" ON "public"."requests" USING "btree" ("created_by");



CREATE INDEX "ix_profiles_featured_rating" ON "public"."profiles" USING "btree" ("is_featured" DESC, "rating" DESC NULLS LAST);



CREATE INDEX "ix_profiles_last_active" ON "public"."profiles" USING "btree" ("last_active_at" DESC);



CREATE INDEX "ix_requests_status_city" ON "public"."requests" USING "btree" ("status", "city");



CREATE INDEX "ix_user_notifications_unread" ON "public"."user_notifications" USING "btree" ("user_id", "read_at");



CREATE INDEX "ix_user_notifications_user_created" ON "public"."user_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "pro_apps_created_at_idx" ON "public"."pro_applications" USING "btree" ("created_at" DESC);



CREATE INDEX "pro_apps_status_idx" ON "public"."pro_applications" USING "btree" ("status");



CREATE INDEX "pro_apps_user_idx" ON "public"."pro_applications" USING "btree" ("user_id");



CREATE INDEX "professionals_featured_rating_idx" ON "public"."professionals" USING "btree" ("is_featured" DESC, "rating" DESC NULLS LAST);



CREATE INDEX "professionals_last_active_idx" ON "public"."professionals" USING "btree" ("last_active_at" DESC);



CREATE UNIQUE INDEX "ux_applications_unique_per_pair" ON "public"."applications" USING "btree" ("request_id", "professional_id");



CREATE OR REPLACE TRIGGER "set_updated_at_agreements" BEFORE UPDATE ON "public"."agreements" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_applications" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_applications_updated_at" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_offer_status" AFTER INSERT OR UPDATE ON "public"."offers" FOR EACH ROW EXECUTE FUNCTION "public"."on_offer_status_change"();



CREATE OR REPLACE TRIGGER "trg_professionals_updated_at" BEFORE UPDATE ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_requests_updated_at" BEFORE UPDATE ON "public"."requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pro_id_fkey" FOREIGN KEY ("pro_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pro_applications"
    ADD CONSTRAINT "pro_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."service_photos"
    ADD CONSTRAINT "service_photos_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."agreements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_photos"
    ADD CONSTRAINT "service_photos_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_photos"
    ADD CONSTRAINT "service_photos_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."agreements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agreements.insert.by_parties" ON "public"."agreements" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "agreements"."request_id") AND ("r"."created_by" = "auth"."uid"())))) OR ("professional_id" = "auth"."uid"())));



CREATE POLICY "agreements.select.parties" ON "public"."agreements" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "agreements"."request_id") AND ("r"."created_by" = "auth"."uid"())))) OR ("professional_id" = "auth"."uid"())));



CREATE POLICY "agreements.update.by_parties" ON "public"."agreements" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "agreements"."request_id") AND ("r"."created_by" = "auth"."uid"())))) OR ("professional_id" = "auth"."uid"())));



CREATE POLICY "app_delete_own" ON "public"."applications" FOR DELETE TO "authenticated" USING (("professional_id" IN ( SELECT "p"."id"
   FROM "public"."professionals" "p"
  WHERE ("p"."profile_id" = "auth"."uid"()))));



CREATE POLICY "app_insert_self" ON "public"."applications" FOR INSERT TO "authenticated" WITH CHECK ((("professional_id" IN ( SELECT "p"."id"
   FROM "public"."professionals" "p"
  WHERE ("p"."profile_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."status" = 'active'::"text"))))));



CREATE POLICY "app_read" ON "public"."applications" FOR SELECT TO "authenticated" USING ((("professional_id" IN ( SELECT "p"."id"
   FROM "public"."professionals" "p"
  WHERE ("p"."profile_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."created_by" = "auth"."uid"()))))));



CREATE POLICY "app_update_by_owner" ON "public"."applications" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."created_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."created_by" = "auth"."uid"())))));



CREATE POLICY "app_update_own" ON "public"."applications" FOR UPDATE TO "authenticated" USING (("professional_id" IN ( SELECT "p"."id"
   FROM "public"."professionals" "p"
  WHERE ("p"."profile_id" = "auth"."uid"())))) WITH CHECK (("professional_id" IN ( SELECT "p"."id"
   FROM "public"."professionals" "p"
  WHERE ("p"."profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "applications.insert.own" ON "public"."applications" FOR INSERT WITH CHECK (("professional_id" = "auth"."uid"()));



CREATE POLICY "applications.select.by_request_owner" ON "public"."applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."created_by" = "auth"."uid"())))));



CREATE POLICY "applications.select.own" ON "public"."applications" FOR SELECT USING (("professional_id" = "auth"."uid"()));



CREATE POLICY "applications.update.own_or_request_owner" ON "public"."applications" FOR UPDATE USING ((("professional_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."created_by" = "auth"."uid"()))))));



CREATE POLICY "applications_by_professional" ON "public"."applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "applications"."professional_id") AND ("p"."profile_id" = "auth"."uid"())))));



CREATE POLICY "applications_by_request_owner" ON "public"."applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."created_by" = "auth"."uid"())))));



CREATE POLICY "applications_delete_by_professional" ON "public"."applications" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "applications"."professional_id") AND ("p"."profile_id" = "auth"."uid"())))));



CREATE POLICY "applications_insert_self" ON "public"."applications" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "applications"."professional_id") AND ("p"."profile_id" = "auth"."uid"())))));



CREATE POLICY "applications_update_by_request_owner" ON "public"."applications" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."created_by" = "auth"."uid"()))))) WITH CHECK (true);



ALTER TABLE "public"."categories_subcategories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client reads applications on own requests" ON "public"."applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."created_by" = "auth"."uid"())))));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert own application" ON "public"."applications" FOR INSERT WITH CHECK (("professional_id" = "auth"."uid"()));



CREATE POLICY "insert own request" ON "public"."requests" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages.insert.by_conversation" ON "public"."messages" FOR INSERT WITH CHECK ((("conversation_id" IS NOT NULL) AND ("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."customer_id" = "auth"."uid"()) OR ("conversations"."pro_id" = "auth"."uid"())))) AND ("sender_id" = "auth"."uid"())));



CREATE POLICY "messages.select.by_conversation" ON "public"."messages" FOR SELECT USING ((("conversation_id" IS NOT NULL) AND ("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."customer_id" = "auth"."uid"()) OR ("conversations"."pro_id" = "auth"."uid"()))))));



CREATE POLICY "messages.update.read_by_by_participant" ON "public"."messages" FOR UPDATE USING ((("conversation_id" IS NOT NULL) AND ("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."customer_id" = "auth"."uid"()) OR ("conversations"."pro_id" = "auth"."uid"()))))));



ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "offers_insert_client_only" ON "public"."offers" FOR INSERT WITH CHECK ((("auth"."uid"() = "created_by") AND ("auth"."uid"() = "client_id") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "offers"."conversation_id") AND ("c"."customer_id" = "auth"."uid"()))))));



CREATE POLICY "offers_select_participants_only" ON "public"."offers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "offers"."conversation_id") AND (("c"."customer_id" = "auth"."uid"()) OR ("c"."pro_id" = "auth"."uid"()))))));



CREATE POLICY "offers_update_client_cancel" ON "public"."offers" FOR UPDATE USING ((("auth"."uid"() = "client_id") AND ("status" = 'sent'::"public"."offer_status"))) WITH CHECK (("auth"."uid"() = "client_id"));



CREATE POLICY "offers_update_pro_only" ON "public"."offers" FOR UPDATE USING (("auth"."uid"() = "professional_id")) WITH CHECK (("auth"."uid"() = "professional_id"));



CREATE POLICY "participants can insert conversations" ON "public"."conversations" FOR INSERT WITH CHECK ((("auth"."uid"() = "customer_id") OR ("auth"."uid"() = "pro_id")));



CREATE POLICY "participants can select their conversations" ON "public"."conversations" FOR SELECT USING ((("auth"."uid"() = "customer_id") OR ("auth"."uid"() = "pro_id")));



CREATE POLICY "participants can update last_message_at" ON "public"."conversations" FOR UPDATE USING ((("auth"."uid"() = "customer_id") OR ("auth"."uid"() = "pro_id"))) WITH CHECK ((("auth"."uid"() = "customer_id") OR ("auth"."uid"() = "pro_id")));



ALTER TABLE "public"."pro_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pro_apps_insert_self" ON "public"."pro_applications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "pro_apps_select_own" ON "public"."pro_applications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "pro_delete_own" ON "public"."professionals" FOR DELETE TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "pro_insert_self" ON "public"."professionals" FOR INSERT TO "authenticated" WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "pro_read_all" ON "public"."professionals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "pro_update_own" ON "public"."professionals" FOR UPDATE TO "authenticated" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "prof_insert_self" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "prof_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "prof_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."professionals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "professionals_insert_own" ON "public"."professionals" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "professionals_select_public" ON "public"."professionals" FOR SELECT USING ((COALESCE("active", true) = true));



CREATE POLICY "professionals_self_all" ON "public"."professionals" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "professionals_update_own" ON "public"."professionals" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles.insert.own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles.select.own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles.update.own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_self_insert" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_self_select" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_self_update" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read active requests" ON "public"."requests" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "read own applications" ON "public"."applications" FOR SELECT USING (("professional_id" = "auth"."uid"()));



CREATE POLICY "read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "read own requests" ON "public"."requests" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "req_delete_own" ON "public"."requests" FOR DELETE TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "req_insert_self" ON "public"."requests" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "req_read_active" ON "public"."requests" FOR SELECT TO "authenticated" USING (("status" = 'active'::"text"));



CREATE POLICY "req_read_own" ON "public"."requests" FOR SELECT TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "req_update_own" ON "public"."requests" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "requests.insert.own" ON "public"."requests" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "requests.select.active" ON "public"."requests" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "requests.select.own" ON "public"."requests" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "requests.update.own" ON "public"."requests" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "requests_owner_delete" ON "public"."requests" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "requests_owner_insert" ON "public"."requests" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "requests_owner_update" ON "public"."requests" FOR UPDATE USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "requests_public_read" ON "public"."requests" FOR SELECT USING (true);



ALTER TABLE "public"."service_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update application (client on own requests)" ON "public"."applications" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."created_by" = "auth"."uid"())))));



CREATE POLICY "update own application (pro)" ON "public"."applications" FOR UPDATE USING (("professional_id" = "auth"."uid"()));



CREATE POLICY "update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "update own request" ON "public"."requests" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "upsert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_notifications.insert.self" ON "public"."user_notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_notifications.select.own" ON "public"."user_notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_notifications.update.own" ON "public"."user_notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































REVOKE ALL ON FUNCTION "public"."get_applications_with_profile_basic"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_applications_with_profile_basic"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_applications_with_profile_basic"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_applications_with_profile_basic"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_professionals_browse"("p_city" "text", "p_category" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_professionals_browse"("p_city" "text", "p_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_professionals_browse"("p_city" "text", "p_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_professionals_browse"("p_city" "text", "p_category" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_prospects_for_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_prospects_for_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_prospects_for_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_prospects_for_request"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_admins"("_type" "text", "_title" "text", "_body" "text", "_link" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_admins"("_type" "text", "_title" "text", "_body" "text", "_link" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_admins"("_type" "text", "_title" "text", "_body" "text", "_link" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."on_offer_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_offer_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_offer_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."agreements" TO "anon";
GRANT ALL ON TABLE "public"."agreements" TO "authenticated";
GRANT ALL ON TABLE "public"."agreements" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."categories_subcategories" TO "anon";
GRANT ALL ON TABLE "public"."categories_subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories_subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";



GRANT ALL ON TABLE "public"."pro_applications" TO "anon";
GRANT ALL ON TABLE "public"."pro_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."pro_applications" TO "service_role";



GRANT ALL ON TABLE "public"."professionals" TO "anon";
GRANT ALL ON TABLE "public"."professionals" TO "authenticated";
GRANT ALL ON TABLE "public"."professionals" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON TABLE "public"."requests" TO "anon";
GRANT ALL ON TABLE "public"."requests" TO "authenticated";
GRANT ALL ON TABLE "public"."requests" TO "service_role";



GRANT ALL ON TABLE "public"."service_photos" TO "anon";
GRANT ALL ON TABLE "public"."service_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."service_photos" TO "service_role";



GRANT ALL ON TABLE "public"."user_notifications" TO "anon";
GRANT ALL ON TABLE "public"."user_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notifications" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
