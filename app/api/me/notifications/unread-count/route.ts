import { NextResponse } from "next/server";

import getRouteClient from "@/lib/supabase/route-client";
import { createBearerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

async function getClientAndUser(req: Request) {
  const supa = getRouteClient();
  const authHeader = (
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    ""
  ).trim();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1] || (req.headers.get("x-access-token") || "").trim();
  if (token) {
    try {
      const bearer = createBearerClient(token);
      const { data, error } = await bearer.auth.getUser(token);
      if (!error && data?.user) {
        return { client: bearer as typeof supa, userId: data.user.id };
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const { data: auth } = await supa.auth.getUser();
    const userId = auth?.user?.id ?? null;
    return { client: supa, userId };
  } catch {
    return { client: supa, userId: null };
  }
}

export async function GET(req: Request) {
  const hasEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!hasEnv) {
    return NextResponse.json(
      { ok: true, count: 0 },
      { status: 200, headers: JSONH },
    );
  }

  const { client, userId } = await getClientAndUser(req);
  if (!userId) {
    return NextResponse.json(
      { ok: true, count: 0 },
      { status: 200, headers: JSONH },
    );
  }

  try {
    const { count, error } = await client
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return NextResponse.json(
      { ok: true, count: count ?? 0 },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: true, count: 0, error: msg },
      { status: 200, headers: JSONH },
    );
  }
}
