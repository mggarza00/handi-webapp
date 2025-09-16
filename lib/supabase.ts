// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Resolver variables lazily para evitar errores en import-time
function getEnv() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, anon, service };
}

/**
 * Cliente público (usa ANON). Respeta RLS. Úsalo en componentes/edge si aplica.
 */
export function createPublicClient() {
  const { url, anon } = getEnv();
  if (!url) throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL no definido");
  if (!anon)
    throw new Error("SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY no definido");
  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}

/**
 * Cliente de servidor con SERVICE ROLE (omnipermisos). Úsalo sólo en route handlers.
 * Ideal para endpoints “de confianza” que deben insertar/leer sin fricción.
 */
export function createServerClient() {
  const { url, service } = getEnv();
  if (!url) throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL no definido");
  if (!service) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, service, {
    auth: { persistSession: false },
  });
}

/**
 * Cliente público que adjunta un access token en cada request (Authorization: Bearer ...)
 * para ejecutar RLS como el usuario del token sin depender de cookies.
 */
export function createBearerClient(token: string) {
  const { url, anon } = getEnv();
  if (!url) throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL no definido");
  if (!anon)
    throw new Error("SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY no definido");
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
