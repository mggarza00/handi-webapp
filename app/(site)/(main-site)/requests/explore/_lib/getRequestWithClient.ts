// app/requests/explore/_lib/getRequestWithClient.ts
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

export type ClientLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  rating: number | null;
};

export type RequestLite = Pick<
  Database["public"]["Tables"]["requests"]["Row"],
  "id" | "title" | "status" | "budget" | "created_at" | "created_by"
>;

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED_SUPABASE");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getRequestWithClient(id: string): Promise<{
  request: RequestLite | null;
  client: ClientLite | null;
}> {
  const admin = supaAdmin();

  const { data: req, error: reqErr } = await admin
    .from("requests")
    .select("id, title, status, budget, created_at, created_by")
    .eq("id", id)
    .maybeSingle<RequestLite>();
  if (reqErr) throw reqErr;

  // En este esquema, el cliente es el creador de la solicitud
  const cid = req?.created_by || null;
  let client: ClientLite | null = null;
  if (cid) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url, rating")
      .eq("id", cid)
      .maybeSingle<{ id: string; full_name: string | null; avatar_url: string | null; rating: number | null }>();
    client = prof ?? null;
  }

  // Logs temporales para QA (se pueden remover después)
  // eslint-disable-next-line no-console
  console.log("[explore:getRequestWithClient]", { id, clientId: cid, clientName: client?.full_name });

  return { request: req ?? null, client };
}
