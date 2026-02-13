import { NextResponse } from "next/server";

import getRouteClient from "@/lib/supabase/route-client";
import { createBearerClient } from "@/lib/supabase";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const CACHEH = {
  ...JSONH,
  "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
} as const;
const MAINTENANCE = process.env.MAINTENANCE_MODE === "true";
const LOG_TIMING = process.env.LOG_TIMING === "1";

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
  const t0 = Date.now();
  const hasEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!hasEnv) {
    return NextResponse.json(
      { ok: true, count: 0 },
      { status: 200, headers: CACHEH },
    );
  }
  if (MAINTENANCE) {
    return NextResponse.json(
      { ok: false, maintenance: true },
      { status: 503, headers: { ...JSONH, "Cache-Control": "no-store" } },
    );
  }

  const { client, userId } = await getClientAndUser(req);
  if (!userId) {
    return NextResponse.json(
      { ok: true, count: 0 },
      { status: 200, headers: CACHEH },
    );
  }

  try {
    const ip = getClientIp(req);
    const limiterKey = `notifications-unread:${userId || ip}`;
    const limit = checkRateLimit(limiterKey, 30, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            ...JSONH,
            "Cache-Control": "no-store",
            "Retry-After": Math.ceil(limit.resetMs / 1000).toString(),
          },
        },
      );
    }
    const { count, error } = await client
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return NextResponse.json(
      { ok: true, count: count ?? 0 },
      { status: 200, headers: CACHEH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: true, count: 0, error: msg },
      { status: 200, headers: CACHEH },
    );
  } finally {
    if (LOG_TIMING) {
      // eslint-disable-next-line no-console
      console.info("[timing] /api/me/notifications/unread-count", {
        ms: Date.now() - t0,
        userId: userId ?? null,
      });
    }
  }
}
