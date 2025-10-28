// lib/supabase-browser.ts
// Compat wrapper for legacy imports. Use @supabase/ssr browser client.
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

export const supabaseBrowser = createSupabaseBrowser<Database>();
