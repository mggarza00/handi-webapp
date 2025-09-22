// app/requests/explore/_lib/getRequestWithClient.ts
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

export type ClientLite = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "avatar_url"
>;

export type RequestLite = Pick<
  Database["public"]["Tables"]["requests"]["Row"],
  "id" | "title" | "status" | "budget" | "created_at" | "created_by"
> & { client_id?: string | null };

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
    .select("id, title, status, budget, created_at, created_by, client_id")
    .eq("id", id)
    .maybeSingle<RequestLite>();
  if (reqErr) throw reqErr;

  const cid = (req?.client_id ?? req?.created_by) || null;
  let client: ClientLite | null = null;
  if (cid) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", cid)
      .maybeSingle<ClientLite>();
    client = prof ?? null;
  }

  // Logs temporales para QA (se pueden remover después)
  // eslint-disable-next-line no-console
  console.log("[explore:getRequestWithClient]", { id, cid, clientName: client?.full_name });

  return { request: req ?? null, client };
}
