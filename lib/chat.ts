import { createServerClient } from "@/lib/supabase";
import type { Conversation, ConversationRow } from "@/types/chat";
import { mapConversationRow } from "@/types/chat";

/**
 * Crea o retorna la conversación (requestId + customerId + proId).
 * Usa SERVICE ROLE (omnipermisos) para que no falle por RLS desde route handlers.
 */
export async function getOrCreateConversation(
  requestId: string,
  proId: string,
  customerId: string,
): Promise<Conversation> {
  const supa = createServerClient();

  // Intentar upsert directo (unique: request_id, customer_id, pro_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const up = await (supa as any)
    .from("conversations")
    .upsert(
      [
        {
          request_id: requestId,
          customer_id: customerId,
          pro_id: proId,
        },
      ],
      { onConflict: "request_id,customer_id,pro_id" },
    )
    .select("id, request_id, customer_id, pro_id, last_message_at, created_at")
    .single();

  if (!up.error && up.data) return mapConversationRow(up.data as ConversationRow);

  // En caso de carreras o variación de orden, buscar explícitamente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = await (supa as any)
    .from("conversations")
    .select("id, request_id, customer_id, pro_id, last_message_at, created_at")
    .eq("request_id", requestId)
    .eq("customer_id", customerId)
    .eq("pro_id", proId)
    .maybeSingle();
  if (q.data) return mapConversationRow(q.data as ConversationRow);

  // Si seguimos sin datos, propaga el error original o uno genérico
  throw new Error(up.error?.message || "CONVERSATION_UPSERT_FAILED");
}

