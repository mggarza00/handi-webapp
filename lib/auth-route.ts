import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import { ApiError } from "@/lib/_supabase-server";
import { createPublicClient, createBearerClient } from "@/lib/supabase";

type DBClient = SupabaseClient<Database, "public", "public">;

export async function getRouteUserOrThrow(): Promise<{
  supabase: DBClient;
  user: User;
}> {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;
  if (!user) throw new ApiError(401, "UNAUTHORIZED");
  return { supabase: supabase as unknown as DBClient, user };
}

// Variante que intenta cookies y luego Authorization: Bearer <token>
export async function getUserFromRequestOrThrow(req: Request): Promise<{
  user: User;
}> {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data } = await supabase.auth.getUser();
    if (data.user) return { user: data.user };
  } catch {
    // ignore and try bearer
  }

  const authH = (req.headers.get("authorization") || req.headers.get("Authorization") || "").trim();
  const m = authH.match(/^Bearer\s+(.+)$/i);
  let token = m?.[1] || "";
  if (!token) {
    const xa = req.headers.get("x-access-token") || req.headers.get("X-Access-Token") || "";
    token = xa.trim();
  }
  if (!token) throw new ApiError(401, "MISSING_AUTH", "No cookie session and no Authorization header");

  const pub = createPublicClient();
  const { data, error } = await pub.auth.getUser(token);
  if (error || !data.user)
    throw new ApiError(401, "INVALID_TOKEN", error?.message || "invalid or expired token");
  return { user: data.user };
}

// Dev-only fallback: permitir x-user-id cuando no llegan cookies ni Authorization
export async function getDevUserFromHeader(req: Request): Promise<{ user: User } | null> {
  if (process.env.NODE_ENV === "production") return null;
  const xuid = (req.headers.get("x-user-id") || req.headers.get("X-User-Id") || "").trim();
  if (!xuid) return null;
  const user = { id: xuid } as unknown as User;
  return { user };
}


// Devuelve un Supabase client enlazado al request: primero cookies; si no, Bearer token
export async function getDbClientForRequest(req: Request): Promise<DBClient> {
  try {
    const rc = createRouteHandlerClient<Database>({ cookies });
    const { data } = await rc.auth.getUser();
    if (data.user) return rc as unknown as DBClient;
  } catch {
    // continue to bearer
  }
  const authH = (req.headers.get("authorization") || req.headers.get("Authorization") || "").trim();
  const m = authH.match(/^Bearer\s+(.+)$/i);
  let token = m?.[1] || "";
  if (!token) token = (req.headers.get("x-access-token") || req.headers.get("X-Access-Token") || "").trim();
  if (!token) throw new ApiError(401, "MISSING_AUTH", "No session cookie or bearer token");
  const bc = createBearerClient(token);
  return bc as unknown as DBClient;
}
