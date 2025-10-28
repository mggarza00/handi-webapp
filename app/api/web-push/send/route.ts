import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import createClient from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

function getVapid() {
  const pub = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:soporte@handi.mx";
  if (!pub || !priv) throw new Error("Missing VAPID keys");
  webpush.setVapidDetails(subject, pub, priv);
}

type Payload = {
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  vibrate?: number[];
  actions?: Array<{ action: string; title: string; icon?: string }>;
};

export async function POST(req: NextRequest) {
  try {
    getVapid();
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401, headers: JSONH });

    const payload = (await req.json().catch(() => ({}))) as Payload;
    const finalPayload: Required<Pick<Payload, 'title' | 'body'>> & Payload = {
      title: payload.title || 'Handi',
      body: payload.body || 'Tienes una nueva notificación',
      ...payload,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supaAny = supabase as any;
    const { data: subs, error } = await supaAny
      .from("web_push_subscriptions")
      .select("id, endpoint, keys, p256dh, auth")
      .eq("user_id", userId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });

    const results: Array<{ id: string; ok: boolean; status?: number; error?: string }> = [];
    for (const s of subs || []) {
      const rawKeys = (s as any).keys || { p256dh: (s as any).p256dh, auth: (s as any).auth };
      if (!rawKeys?.p256dh || !rawKeys?.auth) continue;
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: rawKeys.p256dh, auth: rawKeys.auth },
      } as any;
      try {
        const res = await webpush.sendNotification(subscription, JSON.stringify(finalPayload));
        results.push({ id: s.id, ok: true, status: res.statusCode });
      } catch (err) {
        const e = err as any;
        const status = e?.statusCode || e?.status || 0;
        results.push({ id: s.id, ok: false, status, error: e?.body || e?.message || 'SEND_FAILED' });
        // Clean up gone subscriptions
        if (status === 404 || status === 410) {
          await supaAny.from("web_push_subscriptions").delete().eq("id", s.id);
        }
      }
    }

    return NextResponse.json({ ok: true, sent: results.filter(r => r.ok).length, results }, { status: 200, headers: JSONH });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500, headers: JSONH });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
