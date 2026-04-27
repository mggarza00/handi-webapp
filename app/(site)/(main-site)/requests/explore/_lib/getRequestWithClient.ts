// app/requests/explore/_lib/getRequestWithClient.ts
import { createClient } from "@supabase/supabase-js";

import { resolveRequestClientProfileId } from "@/lib/clients/client-profile-link";
import { resolveClientProfileByAnyId } from "@/lib/clients/resolve-client-profile";
import { getUserRatingSummary } from "@/lib/professionals/ratings";
import type { Database } from "@/types/supabase";

export type ClientLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  rating: number | null;
};

export type RequestLite = Pick<
  Database["public"]["Tables"]["requests"]["Row"],
  | "id"
  | "title"
  | "status"
  | "budget"
  | "created_at"
  | "created_by"
  | "client_id"
>;

function isMissingClientIdColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code =
    "code" in error && typeof error.code === "string" ? error.code : null;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return code === "42703" && message.includes("client_id");
}

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

  let { data: req, error: reqErr } = await admin
    .from("requests")
    .select("id, title, status, budget, created_at, created_by, client_id")
    .eq("id", id)
    .maybeSingle<RequestLite>();

  if (isMissingClientIdColumnError(reqErr)) {
    const fallback = await admin
      .from("requests")
      .select("id, title, status, budget, created_at, created_by")
      .eq("id", id)
      .maybeSingle<RequestLite>();
    req = fallback.data;
    reqErr = fallback.error;
  }

  if (reqErr) throw reqErr;

  const cid = resolveRequestClientProfileId({
    requestClientId: req?.client_id ?? null,
    createdBy: req?.created_by ?? null,
  });
  let client: ClientLite | null = null;
  if (cid) {
    const { profile: prof } = await resolveClientProfileByAnyId<{
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      rating: number | null;
    }>(admin, cid, "id, full_name, avatar_url, rating");
    if (prof) {
      const ratingSummary = await getUserRatingSummary(admin, cid);
      client = {
        ...prof,
        rating: ratingSummary.average ?? prof.rating ?? null,
      };
    }
  }

  // Logs temporales para QA (se pueden remover después)
  // eslint-disable-next-line no-console
  console.log("[explore:getRequestWithClient]", {
    id,
    clientId: cid,
    clientName: client?.full_name,
  });

  return { request: req ?? null, client };
}
