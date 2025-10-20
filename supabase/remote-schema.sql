

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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



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


CREATE OR REPLACE FUNCTION "public"."accept_offer_tx"("p_offer_id" "uuid", "p_actor" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_professional uuid;
  v_status text;
begin
  -- 0) Requisitos previos
  if p_offer_id is null or p_actor is null then
    return json_build_object('ok', false, 'error', 'bad_params');
  end if;

  -- 1) Candado de cuenta bancaria confirmada
  if not public.has_confirmed_bank_account(p_actor) then
    return json_build_object('ok', false, 'error', 'bank_account_required');
  end if;

  -- 2) Toma la oferta con FOR UPDATE (evita carreras)
  select professional_id, status::text
  into v_professional, v_status
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'offer_not_found');
  end if;

  -- 3) Propiedad y estado válido (en este esquema, 'sent' → aceptable)
  if v_professional <> p_actor then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_status <> 'sent' then
    return json_build_object('ok', false, 'error', 'invalid_state');
  end if;

  -- 4) Actualiza estado a accepted
  update public.offers
  set status = 'accepted'
  where id = p_offer_id;

  return json_build_object('ok', true);
end;
$$;


ALTER FUNCTION "public"."accept_offer_tx"("p_offer_id" "uuid", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cba_insert"("p_user_id" "uuid", "p_account_holder" "text", "p_bank_name" "text", "p_bank_code" "text", "p_alias" "text", "p_clabe" "text", "p_is_default" boolean, "p_cipher_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
declare
  v_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if p_user_id <> auth.uid() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_clabe is null or char_length(p_clabe) <> 18 or p_clabe !~ '^\d{18}$' then
    raise exception 'CLABE debe tener 18 dígitos' using errcode = '22000';
  end if;

  if coalesce(p_is_default, false) then
    update public.customer_bank_accounts
      set is_default = false
    where user_id = p_user_id and is_default = true;
  end if;

  insert into public.customer_bank_accounts(
    id, user_id, account_holder, bank_name, bank_code, alias,
    clabe_enc, clabe_last4, is_default
  )
  values (
    v_id, p_user_id, p_account_holder, p_bank_name, p_bank_code, p_alias,
    pgp_sym_encrypt(p_clabe::text, p_cipher_key),
    right(p_clabe, 4),
    coalesce(p_is_default, false)
  );

  return v_id;
end;
$_$;


ALTER FUNCTION "public"."cba_insert"("p_user_id" "uuid", "p_account_holder" "text", "p_bank_name" "text", "p_bank_code" "text", "p_alias" "text", "p_clabe" "text", "p_is_default" boolean, "p_cipher_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cba_update"("p_id" "uuid", "p_user_id" "uuid", "p_account_holder" "text" DEFAULT NULL::"text", "p_bank_name" "text" DEFAULT NULL::"text", "p_bank_code" "text" DEFAULT NULL::"text", "p_alias" "text" DEFAULT NULL::"text", "p_clabe" "text" DEFAULT NULL::"text", "p_is_default" boolean DEFAULT NULL::boolean, "p_cipher_key" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if p_user_id <> auth.uid() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_is_default is true then
    update public.customer_bank_accounts
      set is_default = false
    where user_id = p_user_id and is_default = true and id <> p_id;
  end if;

  if p_clabe is not null then
    if char_length(p_clabe) <> 18 or p_clabe !~ '^\d{18}$' then
      raise exception 'CLABE debe tener 18 dígitos' using errcode = '22000';
    end if;
  end if;

  update public.customer_bank_accounts
  set
    account_holder = coalesce(p_account_holder, account_holder),
    bank_name      = coalesce(p_bank_name, bank_name),
    bank_code      = coalesce(p_bank_code, bank_code),
    alias          = coalesce(p_alias, alias),
    clabe_enc      = case when p_clabe is not null then pgp_sym_encrypt(p_clabe::text, p_cipher_key) else clabe_enc end,
    clabe_last4    = case when p_clabe is not null then right(p_clabe, 4) else clabe_last4 end,
    is_default     = coalesce(p_is_default, is_default)
  where id = p_id and user_id = p_user_id;
end;
$_$;


ALTER FUNCTION "public"."cba_update"("p_id" "uuid", "p_user_id" "uuid", "p_account_holder" "text", "p_bank_name" "text", "p_bank_code" "text", "p_alias" "text", "p_clabe" "text", "p_is_default" boolean, "p_cipher_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_requests_auto_finish"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.finalized_by_client_at is not null and new.finalized_by_pro_at is not null then
    new.status := 'finished';
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_requests_auto_finish"() OWNER TO "postgres";


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
         pr.rating as pro_rating,
         p.headline as pro_headline
  from public.applications a
  join public.requests r on r.id = a.request_id
  join public.professionals p on p.id = a.professional_id
  left join public.profiles pr on pr.id = p.id
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
         pr.rating,
         p.is_featured,
         p.city,
         p.last_active_at
  from public.professionals p
  join public.profiles pr on pr.id = p.id
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
           pr.rating desc nulls last,
           p.last_active_at desc nulls last
  limit 200;
$$;


ALTER FUNCTION "public"."get_professionals_browse"("p_city" "text", "p_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_prospects_for_request"("p_request_id" "uuid") RETURNS TABLE("professional_id" "uuid", "full_name" "text", "headline" "text", "rating" numeric, "is_featured" boolean, "last_active_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.id as professional_id,
         p.full_name,
         p.headline,
         pr.rating,
         p.is_featured,
         p.last_active_at
  from public.requests r
  join public.professionals p on true
  join public.profiles pr on pr.id = p.id
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
           pr.rating desc nulls last,
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


CREATE OR REPLACE FUNCTION "public"."has_confirmed_bank_account"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from public.bank_accounts b
    where b.profile_id = uid and b.status = 'confirmed'
  );
$$;


ALTER FUNCTION "public"."has_confirmed_bank_account"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_conversation_participant"("conv_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.conversations c
    where c.id = conv_id
      and (c.customer_id = auth.uid() or c.pro_id = auth.uid())
  );
$$;


ALTER FUNCTION "public"."is_conversation_participant"("conv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admins"("_type" "text", "_title" "text", "_body" "text", "_link" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.user_notifications (user_id, type, title, body, link)
  select p.id, _type, _title, _body, _link
  from public.profiles p
  where p.role = 'admin';
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


CREATE OR REPLACE FUNCTION "public"."recalc_professional_rating"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_avg numeric;
begin
  select avg(stars)::numeric into v_avg from public.ratings where to_user_id = p_user_id;
  update public.profiles pr set rating = v_avg where pr.id = p_user_id;
end $$;


ALTER FUNCTION "public"."recalc_professional_rating"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_professional_rfc_on_accept"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$                                                                                                                                              
  BEGIN                                                                                                                                              
  IF NEW.status = 'accepted' AND NEW.user_id IS NOT NULL AND NEW.rfc IS NOT NULL THEN                                                                
      INSERT INTO public.professionals AS p (id, rfc)                                                                                                
      VALUES (NEW.user_id, upper(NEW.rfc))                                                                                                           
      ON CONFLICT (id) DO UPDATE                                                                                                                     
        SET rfc = EXCLUDED.rfc;                                                                                                                      
  END IF;                                                                                                                                            
  RETURN NEW;                                                                                                                                        
  END;                                                                                                                                               
  $$;


ALTER FUNCTION "public"."sync_professional_rfc_on_accept"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_ratings_recalc_professional"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_target uuid;
begin
  if tg_op = 'DELETE' then
    v_target := old.to_user_id;
  else
    v_target := new.to_user_id;
  end if;
  perform public.recalc_professional_rating(v_target);
  return null; -- AFTER trigger, no row change
end $$;


ALTER FUNCTION "public"."tg_ratings_recalc_professional"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."tg_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_update_message_attachment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.messages
      set attachment_count = coalesce(attachment_count, 0) + 1
      where id = new.message_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.messages
      set attachment_count = greatest(coalesce(attachment_count, 0) - 1, 0)
      where id = old.message_id;
    return old;
  else
    return null;
  end if;
end $$;


ALTER FUNCTION "public"."tg_update_message_attachment_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end; $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_user_address"("p_address_line" "text", "p_place_id" "text", "p_lat" double precision, "p_lng" double precision) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    return;
  end if;

  if exists (
    select 1
    from public.user_saved_addresses
    where user_id = uid
      and (
        address_place_id is not distinct from nullif(p_place_id, '')
        or address_line ilike p_address_line
      )
  ) then
    update public.user_saved_addresses
      set last_used_at = now()
    where user_id = uid
      and (
        address_place_id is not distinct from nullif(p_place_id, '')
        or address_line ilike p_address_line
      );
  else
    insert into public.user_saved_addresses (user_id, address_line, address_place_id, lat, lng, last_used_at)
    values (uid, p_address_line, nullif(p_place_id, ''), p_lat, p_lng, now());
  end if;
end;
$$;


ALTER FUNCTION "public"."upsert_user_address"("p_address_line" "text", "p_place_id" "text", "p_lat" double precision, "p_lng" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_user_address"("address_line" "text", "address_place_id" "text" DEFAULT NULL::"text", "lat" double precision DEFAULT NULL::double precision, "lng" double precision DEFAULT NULL::double precision, "label" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Buscar coincidencia por place_id si existe
  if address_place_id is not null and btrim(address_place_id) <> '' then
    select id into v_id
    from public.user_saved_addresses
    where user_id = v_user_id and address_place_id = address_place_id
    limit 1;
  end if;

  -- Si no hubo match, buscar por address_line exacto
  if v_id is null then
    select id into v_id
    from public.user_saved_addresses
    where user_id = v_user_id and address_line = address_line
    limit 1;
  end if;

  if v_id is not null then
    update public.user_saved_addresses
    set last_used_at = now(),
        address_place_id = coalesce(nullif(address_place_id, ''), public.user_saved_addresses.address_place_id),
        lat = coalesce(lat, public.user_saved_addresses.lat),
        lng = coalesce(lng, public.user_saved_addresses.lng),
        label = coalesce(label, public.user_saved_addresses.label)
    where id = v_id;
  else
    insert into public.user_saved_addresses (user_id, address_line, address_place_id, lat, lng, label, last_used_at)
    values (v_user_id, address_line, nullif(address_place_id, ''), lat, lng, label, now())
    returning id into v_id;
  end if;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."upsert_user_address"("address_line" "text", "address_place_id" "text", "lat" double precision, "lng" double precision, "label" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."_fix_pros" (
    "id" "uuid" NOT NULL,
    "profile_id" "text",
    "headline" "text",
    "skills" "jsonb",
    "rating" double precision,
    "is_featured" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "active" boolean,
    "full_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "years_experience" bigint,
    "city" "text",
    "cities" "jsonb",
    "categories" "jsonb",
    "subcategories" "jsonb",
    "last_active_at" timestamp with time zone,
    "empresa" boolean
);


ALTER TABLE "public"."_fix_pros" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "account_holder_name" "text" NOT NULL,
    "bank_name" "text",
    "rfc" "text",
    "clabe" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bank_accounts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'archived'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories_subcategories" (
    "Categoría" "text" NOT NULL,
    "Subcategoría" "text" NOT NULL,
    "Descripción" "text",
    "Activa" "text",
    "Ícono" "text",
    "Tipo de servicio" "text",
    "Nivel de especialización" "text",
    "categories_subcategories_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
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


CREATE TABLE IF NOT EXISTS "public"."customer_bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_holder" "text" NOT NULL,
    "bank_name" "text" NOT NULL,
    "bank_code" "text",
    "alias" "text",
    "clabe_enc" "bytea" NOT NULL,
    "clabe_last4" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_bank_accounts_clabe_last4_check" CHECK (("char_length"("clabe_last4") = 4))
);


ALTER TABLE "public"."customer_bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "uploader_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "byte_size" bigint NOT NULL,
    "width" integer,
    "height" integer,
    "sha256" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."message_attachments" OWNER TO "postgres";


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
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "attachment_count" integer DEFAULT 0 NOT NULL
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
    "empresa" boolean DEFAULT false,
    "rfc" "text" NOT NULL,
    "is_company" boolean DEFAULT false NOT NULL,
    "company_legal_name" "text",
    "company_industry" "text",
    "company_employees_count" integer,
    "company_website" "text",
    "company_doc_incorporation_url" "text",
    "company_csf_url" "text",
    "company_rep_id_front_url" "text",
    "company_rep_id_back_url" "text",
    CONSTRAINT "pro_applications_company_employees_count_check" CHECK ((("company_employees_count" IS NULL) OR ("company_employees_count" > 0))),
    CONSTRAINT "pro_applications_rfc_format_chk" CHECK ((("rfc" IS NULL) OR ("upper"("rfc") ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'::"text")))
);


ALTER TABLE "public"."pro_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professionals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "headline" "text",
    "skills" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
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
    "empresa" boolean DEFAULT false,
    "rfc" "text",
    "is_company" boolean DEFAULT false NOT NULL,
    "company_legal_name" "text",
    "company_industry" "text",
    "company_employees_count" integer,
    "company_website" "text",
    "company_doc_incorporation_url" "text",
    "company_csf_url" "text",
    "company_rep_id_front_url" "text",
    "company_rep_id_back_url" "text",
    CONSTRAINT "professionals_company_employees_count_check" CHECK ((("company_employees_count" IS NULL) OR ("company_employees_count" > 0))),
    CONSTRAINT "professionals_rfc_format_chk" CHECK ((("rfc" IS NULL) OR ("upper"("rfc") ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'::"text")))
);


ALTER TABLE "public"."professionals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
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


CREATE OR REPLACE VIEW "public"."professionals_with_profile" AS
 SELECT "p"."id",
    "p"."full_name",
    "p"."avatar_url",
    "p"."headline",
    "p"."bio",
    "p"."years_experience",
    "pr"."rating",
    "p"."is_featured",
    "p"."active",
    "p"."empresa",
    "p"."city",
    "p"."cities",
    "p"."categories",
    "p"."subcategories",
    "p"."last_active_at",
    "p"."created_at"
   FROM ("public"."professionals" "p"
     LEFT JOIN "public"."profiles" "pr" ON (("pr"."id" = "p"."id")));


ALTER VIEW "public"."professionals_with_profile" OWNER TO "postgres";


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
    "conditions" "text" DEFAULT ''::"text" NOT NULL,
    "finalized_by_client_at" timestamp with time zone,
    "finalized_by_pro_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "address_line" "text",
    "address_place_id" "text",
    "address_lat" double precision,
    "address_lng" double precision,
    "address_postcode" "text",
    "address_state" "text",
    "address_country" "text",
    "address_context" "jsonb",
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


CREATE TABLE IF NOT EXISTS "public"."user_saved_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text",
    "address_line" "text" NOT NULL,
    "address_place_id" "text",
    "lat" double precision,
    "lng" double precision,
    "last_used_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_saved_addresses" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_customer_bank_accounts_masked" AS
 SELECT "id",
    "user_id",
    "account_holder",
    "bank_name",
    "bank_code",
    "alias",
    ('**************'::"text" || "clabe_last4") AS "clabe_masked",
    "clabe_last4",
    "is_default",
    "created_at",
    "updated_at"
   FROM "public"."customer_bank_accounts";


ALTER VIEW "public"."v_customer_bank_accounts_masked" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_professional_jobs" AS
 SELECT "req"."id" AS "request_id",
    "req"."title" AS "request_title",
    "sp"."professional_id",
    "array_agg"(COALESCE("sp"."image_url") ORDER BY "sp"."uploaded_at") FILTER (WHERE (COALESCE("sp"."image_url") IS NOT NULL)) AS "photos"
   FROM ("public"."requests" "req"
     LEFT JOIN "public"."service_photos" "sp" ON (("sp"."request_id" = "req"."id")))
  WHERE ("req"."status" = 'finished'::"text")
  GROUP BY "req"."id", "req"."title", "sp"."professional_id";


ALTER VIEW "public"."v_professional_jobs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_receipt_pdf" AS
 SELECT ("m"."payload" ->> 'receipt_id'::"text") AS "receipt_id",
    COALESCE(("m"."payload" ->> 'receipt_id'::"text"), ("m"."id")::"text") AS "folio",
    "m"."created_at",
    "c"."request_id",
    COALESCE("req"."title", "off"."title") AS "service_title",
    NULLIF(TRIM(BOTH FROM "req"."description"), ''::"text") AS "service_description",
    "pc"."full_name" AS "client_name",
    "pc"."email" AS "client_email",
    "pp"."full_name" AS "professional_name",
    COALESCE("off"."amount", (0)::numeric) AS "servicio_mxn",
    (0)::numeric AS "comision_mxn",
    (0)::numeric AS "iva_mxn",
    COALESCE("off"."amount", (0)::numeric) AS "total_mxn"
   FROM ((((("public"."messages" "m"
     JOIN "public"."conversations" "c" ON (("c"."id" = "m"."conversation_id")))
     LEFT JOIN "public"."requests" "req" ON (("req"."id" = "c"."request_id")))
     LEFT JOIN "public"."profiles" "pc" ON (("pc"."id" = "c"."customer_id")))
     LEFT JOIN "public"."profiles" "pp" ON (("pp"."id" = "c"."pro_id")))
     LEFT JOIN "public"."offers" "off" ON ((("off"."conversation_id" = "c"."id") AND ("off"."status" = 'paid'::"public"."offer_status"))))
  WHERE (("m"."message_type" = 'system'::"text") AND (("m"."payload" ->> 'receipt_id'::"text") IS NOT NULL));


ALTER VIEW "public"."v_receipt_pdf" OWNER TO "postgres";


ALTER TABLE ONLY "public"."_fix_pros"
    ADD CONSTRAINT "_fix_pros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_request_id_professional_id_key" UNIQUE ("request_id", "professional_id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories_subcategories"
    ADD CONSTRAINT "categories_subcategories_pkey" PRIMARY KEY ("categories_subcategories_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_request_id_customer_id_pro_id_key" UNIQUE ("request_id", "customer_id", "pro_id");



ALTER TABLE ONLY "public"."customer_bank_accounts"
    ADD CONSTRAINT "customer_bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."user_saved_addresses"
    ADD CONSTRAINT "user_saved_addresses_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_applications_prof" ON "public"."applications" USING "btree" ("professional_id");



CREATE INDEX "idx_applications_req" ON "public"."applications" USING "btree" ("request_id");



CREATE INDEX "idx_conversations_customer" ON "public"."conversations" USING "btree" ("customer_id");



CREATE INDEX "idx_conversations_last" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_conversations_pro" ON "public"."conversations" USING "btree" ("pro_id");



CREATE INDEX "idx_conversations_request" ON "public"."conversations" USING "btree" ("request_id");



CREATE INDEX "idx_customer_bank_accounts_user" ON "public"."customer_bank_accounts" USING "btree" ("user_id");



CREATE INDEX "idx_message_attachments_conversation_id" ON "public"."message_attachments" USING "btree" ("conversation_id");



CREATE INDEX "idx_message_attachments_message_id" ON "public"."message_attachments" USING "btree" ("message_id");



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created_ts" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "idx_offers_client_status" ON "public"."offers" USING "btree" ("client_id", "status");



CREATE INDEX "idx_offers_conversation_created" ON "public"."offers" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_offers_professional_status" ON "public"."offers" USING "btree" ("professional_id", "status");



CREATE INDEX "idx_pro_applications_empresa" ON "public"."pro_applications" USING "btree" ("empresa");



CREATE INDEX "idx_pro_applications_is_company" ON "public"."pro_applications" USING "btree" ("is_company");



CREATE INDEX "idx_professionals_empresa" ON "public"."professionals" USING "btree" ("empresa");



CREATE INDEX "idx_professionals_profile" ON "public"."professionals" USING "btree" ("profile_id");



CREATE INDEX "idx_profiles_is_admin" ON "public"."profiles" USING "btree" ("is_admin");



CREATE INDEX "idx_profiles_is_client_pro" ON "public"."profiles" USING "btree" ("is_client_pro");



CREATE INDEX "idx_requests_cat_city" ON "public"."requests" USING "btree" ("category", "city");



CREATE INDEX "idx_requests_created_at" ON "public"."requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_requests_created_by" ON "public"."requests" USING "btree" ("created_by");



CREATE INDEX "ix_profiles_featured_rating" ON "public"."profiles" USING "btree" ("is_featured" DESC, "rating" DESC NULLS LAST);



CREATE INDEX "ix_profiles_last_active" ON "public"."profiles" USING "btree" ("last_active_at" DESC);



CREATE INDEX "ix_profiles_rating" ON "public"."profiles" USING "btree" ("rating" DESC NULLS LAST);



CREATE INDEX "ix_requests_status_city" ON "public"."requests" USING "btree" ("status", "city");



CREATE INDEX "ix_user_notifications_unread" ON "public"."user_notifications" USING "btree" ("user_id", "read_at");



CREATE INDEX "ix_user_notifications_user_created" ON "public"."user_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "pro_applications_rfc_idx" ON "public"."pro_applications" USING "btree" ("rfc");



CREATE INDEX "pro_apps_created_at_idx" ON "public"."pro_applications" USING "btree" ("created_at" DESC);



CREATE INDEX "pro_apps_status_idx" ON "public"."pro_applications" USING "btree" ("status");



CREATE INDEX "pro_apps_user_idx" ON "public"."pro_applications" USING "btree" ("user_id");



CREATE INDEX "professionals_last_active_idx" ON "public"."professionals" USING "btree" ("last_active_at" DESC);



CREATE INDEX "professionals_rfc_idx" ON "public"."professionals" USING "btree" ("rfc");



CREATE UNIQUE INDEX "uq_bank_accounts_one_confirmed" ON "public"."bank_accounts" USING "btree" ("profile_id") WHERE ("status" = 'confirmed'::"text");



CREATE UNIQUE INDEX "uq_customer_bank_accounts_default" ON "public"."customer_bank_accounts" USING "btree" ("user_id") WHERE "is_default";



CREATE UNIQUE INDEX "uq_professionals_profile_id" ON "public"."professionals" USING "btree" ("profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "user_saved_addresses_user_id_idx" ON "public"."user_saved_addresses" USING "btree" ("user_id");



CREATE UNIQUE INDEX "ux_applications_unique_per_pair" ON "public"."applications" USING "btree" ("request_id", "professional_id");



CREATE UNIQUE INDEX "ux_user_saved_addresses_user_line" ON "public"."user_saved_addresses" USING "btree" ("user_id", "address_line");



CREATE UNIQUE INDEX "ux_user_saved_addresses_user_place" ON "public"."user_saved_addresses" USING "btree" ("user_id", "address_place_id") WHERE ("address_place_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "set_updated_at_agreements" BEFORE UPDATE ON "public"."agreements" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_applications" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_applications_updated_at" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_messages_attachment_count_del" AFTER DELETE ON "public"."message_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."tg_update_message_attachment_count"();



CREATE OR REPLACE TRIGGER "trg_messages_attachment_count_ins" AFTER INSERT ON "public"."message_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."tg_update_message_attachment_count"();



CREATE OR REPLACE TRIGGER "trg_offer_status" AFTER INSERT OR UPDATE ON "public"."offers" FOR EACH ROW EXECUTE FUNCTION "public"."on_offer_status_change"();



CREATE OR REPLACE TRIGGER "trg_professionals_updated_at" BEFORE UPDATE ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_requests_auto_finish" BEFORE UPDATE OF "finalized_by_client_at", "finalized_by_pro_at" ON "public"."requests" FOR EACH ROW EXECUTE FUNCTION "public"."fn_requests_auto_finish"();



CREATE OR REPLACE TRIGGER "trg_requests_updated_at" BEFORE UPDATE ON "public"."requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_professional_rfc_on_accept" AFTER UPDATE OF "status" ON "public"."pro_applications" FOR EACH ROW WHEN ((("new"."status" = 'accepted'::"text") AND ("old"."status" IS DISTINCT FROM "new"."status"))) EXECUTE FUNCTION "public"."sync_professional_rfc_on_accept"();



CREATE OR REPLACE TRIGGER "trg_touch_updated_at_cba" BEFORE UPDATE ON "public"."customer_bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pro_id_fkey" FOREIGN KEY ("pro_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_bank_accounts"
    ADD CONSTRAINT "customer_bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "fk_professionals_profile_id" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



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



ALTER TABLE ONLY "public"."user_saved_addresses"
    ADD CONSTRAINT "user_saved_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."_fix_pros" ENABLE ROW LEVEL SECURITY;


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



CREATE POLICY "attachments_delete_owner" ON "public"."message_attachments" FOR DELETE TO "authenticated" USING (("uploader_id" = "auth"."uid"()));



CREATE POLICY "attachments_insert_participants_only" ON "public"."message_attachments" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_conversation_participant"("conversation_id") AND ("uploader_id" = "auth"."uid"())));



CREATE POLICY "attachments_select_participants_only" ON "public"."message_attachments" FOR SELECT TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id"));



ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bank_accounts_insert_own" ON "public"."bank_accounts" FOR INSERT TO "authenticated" WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "bank_accounts_select_own" ON "public"."bank_accounts" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "bank_accounts_update_own" ON "public"."bank_accounts" FOR UPDATE TO "authenticated" USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."categories_subcategories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cba_delete" ON "public"."customer_bank_accounts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cba_insert" ON "public"."customer_bank_accounts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "cba_select" ON "public"."customer_bank_accounts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cba_update" ON "public"."customer_bank_accounts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "client reads applications on own requests" ON "public"."applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."requests" "r"
  WHERE (("r"."id" = "applications"."request_id") AND ("r"."created_by" = "auth"."uid"())))));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_bank_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert own addresses" ON "public"."user_saved_addresses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "insert own application" ON "public"."applications" FOR INSERT WITH CHECK (("professional_id" = "auth"."uid"()));



CREATE POLICY "insert own request" ON "public"."requests" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."message_attachments" ENABLE ROW LEVEL SECURITY;


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



CREATE POLICY "own addresses only" ON "public"."user_saved_addresses" FOR SELECT USING (("auth"."uid"() = "user_id"));



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



CREATE POLICY "update own addresses" ON "public"."user_saved_addresses" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "update own application (pro)" ON "public"."applications" FOR UPDATE USING (("professional_id" = "auth"."uid"()));



CREATE POLICY "update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "update own request" ON "public"."requests" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "upsert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_notifications.insert.self" ON "public"."user_notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_notifications.select.own" ON "public"."user_notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_notifications.update.own" ON "public"."user_notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_saved_addresses" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_offer_tx"("p_offer_id" "uuid", "p_actor" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_offer_tx"("p_offer_id" "uuid", "p_actor" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_offer_tx"("p_offer_id" "uuid", "p_actor" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cba_insert"("p_user_id" "uuid", "p_account_holder" "text", "p_bank_name" "text", "p_bank_code" "text", "p_alias" "text", "p_clabe" "text", "p_is_default" boolean, "p_cipher_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cba_insert"("p_user_id" "uuid", "p_account_holder" "text", "p_bank_name" "text", "p_bank_code" "text", "p_alias" "text", "p_clabe" "text", "p_is_default" boolean, "p_cipher_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cba_insert"("p_user_id" "uuid", "p_account_holder" "text", "p_bank_name" "text", "p_bank_code" "text", "p_alias" "text", "p_clabe" "text", "p_is_default" boolean, "p_cipher_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cba_update"("p_id" "uuid", "p_user_id" "uuid", "p_account_holder" "text", "p_bank_name" "text", "p_bank_code" "text", "p_alias" "text", "p_clabe" "text", "p_is_default" boolean, "p_cipher_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cba_update"("p_id" "uuid", "p_user_id" "uuid", "p_account_holder" "text", "p_bank_name" "text", "p_bank_code" "text", "p_alias" "text", "p_clabe" "text", "p_is_default" boolean, "p_cipher_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cba_update"("p_id" "uuid", "p_user_id" "uuid", "p_account_holder" "text", "p_bank_name" "text", "p_bank_code" "text", "p_alias" "text", "p_clabe" "text", "p_is_default" boolean, "p_cipher_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_requests_auto_finish"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_requests_auto_finish"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_requests_auto_finish"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."has_confirmed_bank_account"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_confirmed_bank_account"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_confirmed_bank_account"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_conversation_participant"("conv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("conv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("conv_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_admins"("_type" "text", "_title" "text", "_body" "text", "_link" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_admins"("_type" "text", "_title" "text", "_body" "text", "_link" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_admins"("_type" "text", "_title" "text", "_body" "text", "_link" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."on_offer_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_offer_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_offer_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_professional_rating"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_professional_rating"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_professional_rating"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_professional_rfc_on_accept"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_professional_rfc_on_accept"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_professional_rfc_on_accept"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_ratings_recalc_professional"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_ratings_recalc_professional"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_ratings_recalc_professional"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_update_message_attachment_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_update_message_attachment_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_update_message_attachment_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_user_address"("p_address_line" "text", "p_place_id" "text", "p_lat" double precision, "p_lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_user_address"("p_address_line" "text", "p_place_id" "text", "p_lat" double precision, "p_lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_user_address"("p_address_line" "text", "p_place_id" "text", "p_lat" double precision, "p_lng" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_user_address"("address_line" "text", "address_place_id" "text", "lat" double precision, "lng" double precision, "label" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_user_address"("address_line" "text", "address_place_id" "text", "lat" double precision, "lng" double precision, "label" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_user_address"("address_line" "text", "address_place_id" "text", "lat" double precision, "lng" double precision, "label" "text") TO "service_role";



GRANT ALL ON TABLE "public"."_fix_pros" TO "anon";
GRANT ALL ON TABLE "public"."_fix_pros" TO "authenticated";
GRANT ALL ON TABLE "public"."_fix_pros" TO "service_role";



GRANT ALL ON TABLE "public"."agreements" TO "anon";
GRANT ALL ON TABLE "public"."agreements" TO "authenticated";
GRANT ALL ON TABLE "public"."agreements" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."categories_subcategories" TO "anon";
GRANT ALL ON TABLE "public"."categories_subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories_subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."customer_bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."customer_bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."message_attachments" TO "anon";
GRANT ALL ON TABLE "public"."message_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."message_attachments" TO "service_role";



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



GRANT ALL ON TABLE "public"."professionals_with_profile" TO "anon";
GRANT ALL ON TABLE "public"."professionals_with_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."professionals_with_profile" TO "service_role";



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



GRANT ALL ON TABLE "public"."user_saved_addresses" TO "anon";
GRANT ALL ON TABLE "public"."user_saved_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."user_saved_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."v_customer_bank_accounts_masked" TO "anon";
GRANT ALL ON TABLE "public"."v_customer_bank_accounts_masked" TO "authenticated";
GRANT ALL ON TABLE "public"."v_customer_bank_accounts_masked" TO "service_role";



GRANT ALL ON TABLE "public"."v_professional_jobs" TO "anon";
GRANT ALL ON TABLE "public"."v_professional_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."v_professional_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."v_receipt_pdf" TO "anon";
GRANT ALL ON TABLE "public"."v_receipt_pdf" TO "authenticated";
GRANT ALL ON TABLE "public"."v_receipt_pdf" TO "service_role";



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
