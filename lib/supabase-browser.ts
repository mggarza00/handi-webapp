// lib/supabase-browser.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url) {
  throw new Error("Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL");
}
if (!anonKey) {
  throw new Error("Falta la variable de entorno NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabaseBrowser = createClient(url, anonKey);
