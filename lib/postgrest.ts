// lib/postgrest.ts
// Helper de bajo nivel para hablar con PostgREST directamente

export type OfferRow = {
  id: string;
  status: string;
  conversation_id: string | null;
  checkout_url?: string | null;
};

function getRestBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL en el entorno");
  return `${url.replace(/\/$/, "")}/rest/v1`;
}

function getServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno");
  return key;
}

/**
 * PATCH offers → status='accepted' condicionado a status='sent' (idempotente)
 * Mantiene filtros `id=eq...&status=eq.sent` y envía body JSON.
 * Retorna la fila actualizada si aplica (Prefer: return=representation).
 */
export async function patchOfferAcceptViaRest(
  offerId: string,
): Promise<{ ok: true; data: OfferRow[]; status: number } | { ok: false; status: number; error?: string }> {
  if (!offerId || typeof offerId !== "string") {
    return { ok: false, status: 400, error: "offer_id_missing" };
  }
  const base = getRestBaseUrl();
  const key = getServiceKey();
  const url = `${base}/offers?id=eq.${encodeURIComponent(offerId)}&status=eq.sent`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Prefer: "return=representation",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ status: "accepted" }),
  });

  const status = res.status;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    let errorMsg: string | undefined = undefined;
    if (data && typeof data === "object" && "message" in data) {
      const m = (data as { message?: unknown }).message;
      if (typeof m === "string") errorMsg = m;
    }
    return { ok: false, status, error: errorMsg };
  }
  const rows = Array.isArray(data) ? (data as OfferRow[]) : [];
  return { ok: true, status, data: rows };
}
