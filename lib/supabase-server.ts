import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Cliente de servidor (usa cookieStore para auth)
export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");

  const cookieStore = cookies();
  return createClient(url, anon, {
    global: { headers: { Cookie: cookieStore.toString() } }
  });
}

// Cliente simple de servidor (sin cookies)
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  return createClient(url, anon);
}

// Obtener usuario autenticado o lanzar error
export async function getUserOrThrow() {
  const supabase = supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("User not authenticated");
  return data.user;
}