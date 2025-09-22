// app/(app)/mensajes/_lib/getConversationForRequest.ts
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED:SUPABASE");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Obtiene la conversación (id) asociada a una request visible para el viewer.
 * Busca por `request_id = id` y `viewerId` como customer o pro.
 * Devuelve null si no existe.
 */
export async function getConversationForRequest(
  requestId: string,
  viewerId: string,
): Promise<string | null> {
  const admin = supaAdmin();
  const { data, error } = await admin
    .from("conversations")
    .select("id, request_id, customer_id, pro_id, last_message_at")
    .eq("request_id", requestId)
    .or(`customer_id.eq.${viewerId},pro_id.eq.${viewerId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) return null;
  return data?.id ?? null;
}

