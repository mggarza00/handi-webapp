import { NextRequest, NextResponse } from "next/server";

import getRouteClient from "@/lib/supabase/route-client";
import { getAdminSupabase } from "@/lib/supabase/admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Keys = { p256dh: string; auth: string };
type Subscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: Keys;
};

function normalizeKeyPair(raw: unknown): Keys | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { p256dh?: unknown; auth?: unknown };
  if (typeof obj.p256dh !== "string" || typeof obj.auth !== "string") {
    return null;
  }
  if (!obj.p256dh || !obj.auth) return null;
  return { p256dh: obj.p256dh, auth: obj.auth };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      subscription?: Subscription;
      userAgent?: string;
      appVersion?: string;
    };
    const sub = body?.subscription as Subscription | undefined;
    const keys = normalizeKeyPair(sub?.keys);

    if (!sub?.endpoint || !keys) {
      return NextResponse.json(
        { ok: false, error: "INVALID_SUBSCRIPTION" },
        { status: 400, headers: JSONH },
      );
    }

    const admin = getAdminSupabase() as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            maybeSingle: () => Promise<{
              data: Record<string, unknown> | null;
              error: { message: string } | null;
            }>;
          };
        };
        upsert: (
          values: Record<string, unknown>,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    };

    // If endpoint already exists with different keys, reject to prevent accidental endpoint hijack.
    const { data: existing, error: existingError } = await admin
      .from("web_push_subscriptions")
      .select("endpoint, user_id, keys, p256dh, auth")
      .eq("endpoint", sub.endpoint)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { ok: false, error: existingError.message },
        { status: 500, headers: JSONH },
      );
    }

    if (existing) {
      const existingKeys =
        normalizeKeyPair(existing.keys) ||
        normalizeKeyPair({
          p256dh: existing.p256dh,
          auth: existing.auth,
        });

      if (
        existingKeys &&
        (existingKeys.p256dh !== keys.p256dh || existingKeys.auth !== keys.auth)
      ) {
        return NextResponse.json(
          { ok: false, error: "ENDPOINT_OWNERSHIP_MISMATCH" },
          { status: 409, headers: JSONH },
        );
      }
    }

    // Reclaims endpoint for the authenticated user when changing accounts on same browser.
    const { error } = await admin.from("web_push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        keys,
      },
      { onConflict: "endpoint" },
    );

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500, headers: JSONH },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500, headers: JSONH },
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
