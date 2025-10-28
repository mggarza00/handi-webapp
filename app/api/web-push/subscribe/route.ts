import { NextRequest, NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Keys = { p256dh: string; auth: string };
type Sub = { endpoint: string; expirationTime?: number | null; keys: Keys };

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401, headers: JSONH });
    }

    const body = (await req.json().catch(() => ({}))) as {
      subscription?: Sub;
      userAgent?: string;
      appVersion?: string;
    };
    if (!body?.subscription?.endpoint || !body.subscription?.keys?.p256dh || !body.subscription?.keys?.auth) {
      return NextResponse.json({ ok: false, error: "INVALID_SUBSCRIPTION" }, { status: 400, headers: JSONH });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supaAny = supabase as any;
    const upsertPayload = {
      user_id: userId,
      endpoint: body.subscription.endpoint,
      p256dh: body.subscription.keys.p256dh,
      auth: body.subscription.keys.auth,
      keys: { p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth },
      user_agent: body.userAgent || null,
      app_version: body.appVersion || null,
      // updated_at handled by trigger if present, else overwritten here
      updated_at: new Date().toISOString(),
    };
    const { error } = await supaAny
      .from("web_push_subscriptions")
      .upsert(upsertPayload, { onConflict: "endpoint" });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
    }
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500, headers: JSONH });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
