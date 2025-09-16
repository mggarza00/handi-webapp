// lib/_supabase-server.ts
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

type DBClient = SupabaseClient<Database, "public", "public">;

export type AuthContext = {
  supabase: DBClient;
  user: User | null;
};

export class ApiError extends Error {
  status: number;
  code: string;
  detail?: string;
  constructor(status: number, code: string, detail?: string) {
    super(code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function getSupabaseServer(): DBClient {
  return createRouteHandlerClient<Database>({ cookies });
}

export const supabaseServer = getSupabaseServer;

export async function getAuthContext(client?: DBClient): Promise<AuthContext> {
  const supabase = client ?? getSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new ApiError(401, "INVALID_TOKEN", error.message);
  }
  return { supabase, user: data.user ?? null };
}

export async function getUserOrThrow(client?: DBClient): Promise<{
  supabase: DBClient;
  user: User;
}> {
  const { supabase, user } = await getAuthContext(client);
  if (!user) throw new ApiError(401, "UNAUTHORIZED");
  return { supabase, user };
}
