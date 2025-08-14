// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Cliente público (usa ANON). Respeta RLS. Úsalo en componentes/edge si aplica.
 */
export function createPublicClient() {
  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}

/**
 * Cliente de servidor con SERVICE ROLE (omnipermisos). Úsalo sólo en route handlers.
 * Ideal para endpoints “de confianza” que deben insertar/leer sin fricción.
 */
export function createServerClient() {
  return createClient(url, service, {
    auth: { persistSession: false },
  });
}
