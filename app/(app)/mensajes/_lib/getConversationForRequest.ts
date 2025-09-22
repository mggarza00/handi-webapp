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

/**
 * Heurística para obtener conversationId a partir de una request:
 * 1) conversations.request_id = requestId (última por last_message_at)
 * 2) offers (request_id = requestId) -> conversation_id (si existe)
 * 3) agreements (request_id = requestId) -> (customer = created_by, pro = professional_id) -> conversations
 * 4) fallback por dupla (customer = created_by, pro = application.professional_id) -> conversations (sin request_id)
 */
export async function getConversationIdForRequest(requestId: string): Promise<string | null> {
  const admin = supaAdmin();
  // Paso 1: conversations por request_id
  const byRequest = await admin
    .from("conversations")
    .select("id, last_message_at")
    .eq("request_id", requestId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!byRequest.error && byRequest.data?.id) return byRequest.data.id;

  // Obtener request para conocer created_by
  const req = await admin
    .from("requests")
    .select("id, created_by")
    .eq("id", requestId)
    .maybeSingle<{ id: string; created_by: string }>();
  const customerId = req.data?.created_by ?? null;

  // Paso 2: offers por request_id con conversation_id
  const offer = await admin
    .from("offers")
    .select("conversation_id, created_at")
    .eq("request_id", requestId)
    .not("conversation_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ conversation_id: string | null }>();
  if (!offer.error && offer.data?.conversation_id) return offer.data.conversation_id;

  // Paso 3: agreements -> professional_id y buscar conversación exacta customer/pro
  const agr = await admin
    .from("agreements")
    .select("professional_id, updated_at")
    .eq("request_id", requestId)
    .order("updated_at", { ascending: false, nullsFirst: true })
    .limit(1)
    .maybeSingle<{ professional_id: string | null }>();
  const proFromAgreement = agr.data?.professional_id ?? null;
  if (customerId && proFromAgreement) {
    const conv = await admin
      .from("conversations")
      .select("id, last_message_at")
      .eq("customer_id", customerId)
      .eq("pro_id", proFromAgreement)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!conv.error && conv.data?.id) return conv.data.id;
  }

  // Paso 4: applications -> professional_id; buscar conversación customer/pro (sin request_id)
  const apps = await admin
    .from("applications")
    .select("professional_id")
    .eq("request_id", requestId)
    .limit(50);
  if (!apps.error && customerId) {
    const pros = (apps.data ?? [])
      .map((r) => (r as { professional_id?: string }).professional_id)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (pros.length) {
      const conv = await admin
        .from("conversations")
        .select("id, last_message_at, pro_id")
        .eq("customer_id", customerId)
        .in("pro_id", pros)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (!conv.error && conv.data?.id) return conv.data.id;
    }
  }

  return null;
}
