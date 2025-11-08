import { NextResponse } from "next/server";
import getRouteClient from "@/lib/supabase/route-client";

import { createBearerClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

async function getClientAndUser(req: Request) {
  const supa = getRouteClient();
  const authHeader = (req.headers.get("authorization") || req.headers.get("Authorization") || "").trim();
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

export async function POST(req: Request) {
  const { client, userId } = await getClientAndUser(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401, headers: JSONH });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = client as any;
    const { error } = await q
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}
