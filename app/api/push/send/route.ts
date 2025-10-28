import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

const JSONH = { 'Content-Type': 'application/json; charset=utf-8' } as const;

// Configure VAPID
const VAPID_SUBJECT = process.env.WEB_PUSH_VAPID_SUBJECT || 'mailto:soportehandi.mx';
const VAPID_PUBLIC = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
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
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json({ error: 'missing VAPID keys' }, { status: 500, headers: JSONH });
    }

    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401, headers: JSONH });

    const payload = (await req.json().catch(() => ({}))) as Payload;
    const finalPayload: Required<Pick<Payload, 'title' | 'body'>> & Payload = {
      title: payload.title || 'Handi',
      body: payload.body || 'Tienes una nueva notificación',
      ...payload,
    };

    // Fetch subscriptions for current user
    const { data: subs, error } = await supabase
      .from('web_push_subscriptions')
      .select('id, endpoint, keys, p256dh, auth')
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: JSONH });

    const results: Array<{ id: string; ok: boolean; status?: number; error?: string }> = [];
    for (const s of subs || []) {
      const rawKeys = (s as any).keys || { p256dh: (s as any).p256dh, auth: (s as any).auth };
      const p256dh = rawKeys?.p256dh;
      const auth = rawKeys?.auth;
      if (!p256dh || !auth) continue;
      const subscription = { endpoint: s.endpoint, keys: { p256dh, auth } } as any;
      try {
        const res = await webpush.sendNotification(subscription, JSON.stringify(finalPayload));
        results.push({ id: s.id, ok: true, status: (res as any)?.statusCode });
      } catch (e: any) {
        const status = e?.statusCode || e?.status || 0;
        results.push({ id: s.id, ok: false, status, error: e?.body || e?.message || 'SEND_FAILED' });
        if (status === 404 || status === 410) {
          // Clean up expired
          await (supabase as any).from('web_push_subscriptions').delete().eq('id', s.id);
        }
      }
    }

    return NextResponse.json({ ok: true, sent: results.filter(r => r.ok).length, results }, { status: 200, headers: JSONH });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500, headers: JSONH });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

