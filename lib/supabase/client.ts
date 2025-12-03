import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/supabase";

export const createSupabaseBrowser = <T = Database>() =>
  createBrowserClient<T>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
