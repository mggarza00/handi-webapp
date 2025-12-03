import type { SupabaseClient } from "@supabase/supabase-js";

import createClient from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";

type RateLimitResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export async function assertRateLimit(action: string, windowSec: number, maxCount: number): Promise<RateLimitResult> {
  const supabase = createClient() as SupabaseClient<Database>;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");

  const sinceIso = new Date(Date.now() - windowSec * 1000).toISOString();
  const { count, error } = await supabase
    .from("api_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("action", action)
    .gte("created_at", sinceIso);

  if (error) throw error;
  if ((count ?? 0) >= maxCount) {
    const retryAfter = Math.max(1, Math.ceil(windowSec / 2));
    return {
      ok: false,
      status: 429,
      message: `Demasiadas solicitudes. Intenta nuevamente en aproximadamente ${retryAfter}s.`,
    };
  }

  await supabase.from("api_events").insert({ user_id: user.id, action });
  return { ok: true };
}
