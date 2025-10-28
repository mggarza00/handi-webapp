// supabase/functions/push-notify/index.ts
// Deno Edge Function: Send Web Push notifications using VAPID.

import 'jsr:supabase/functions-js/edge-runtime.d.ts';
import webpush from 'npm:web-push@3.6.7';

type Keys = { p256dh: string; auth: string };
type Subscription = { endpoint: string; keys: Keys };
type Row = { id: string; endpoint: string; keys?: Keys | null; p256dh?: string; auth?: string };

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

const JSONH = { 'Content-Type': 'application/json; charset=utf-8' } as const;

function setVapid() {
  const subject = Deno.env.get('WEB_PUSH_VAPID_SUBJECT') || 'mailto:soportehandi.mx';
  const pub = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY');
  if (!pub || !priv) throw new Error('Missing WEB_PUSH_VAPID_PUBLIC_KEY/WEB_PUSH_VAPID_PRIVATE_KEY');
  webpush.setVapidDetails(subject, pub, priv);
}

function adminRest(path: string, init: RequestInit = {}) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json; charset=utf-8',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
}

function normalizeRows(rows: Row[]): Subscription[] {
  const out: Subscription[] = [];
  for (const r of rows) {
    const keys = (r.keys as any) ?? { p256dh: r.p256dh, auth: r.auth };
    if (!keys?.p256dh || !keys?.auth) continue;
    out.push({ endpoint: r.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
  }
  return out;
}

export default async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: JSONH });
    }

    setVapid();

    const body = (await req.json().catch(() => ({}))) as {
      toUserId?: string;
      user_id?: string;
      subscription?: Subscription;
      payload?: Payload;
    };

    const payload: Payload = {
      title: body.payload?.title || 'Handi',
      body: body.payload?.body || 'Tienes una notificación',
      url: body.payload?.url || 'https://handi.mx/',
      icon: body.payload?.icon || '/icons/icon-192.png',
      badge: body.payload?.badge || '/icons/badge-72.png',
      tag: body.payload?.tag || 'handi',
      data: body.payload?.data || {},
      requireInteraction: body.payload?.requireInteraction,
      vibrate: body.payload?.vibrate,
      actions: body.payload?.actions,
    } as any;

    let subs: Subscription[] = [];
    if (body.subscription?.endpoint) {
      subs = [body.subscription];
    } else {
      const target = body.toUserId || body.user_id;
      if (!target) {
        return new Response(JSON.stringify({ ok: false, error: 'MISSING_TARGET' }), { status: 400, headers: JSONH });
      }
      const r = await adminRest(`/web_push_subscriptions?select=id,endpoint,keys,p256dh,auth&user_id=eq.${encodeURIComponent(target)}`);
      if (!r.ok) {
        const txt = await r.text();
        return new Response(JSON.stringify({ ok: false, error: 'FETCH_SUBS_FAILED', detail: txt }), { status: 500, headers: JSONH });
      }
      const rows = (await r.json()) as Row[];
      subs = normalizeRows(rows);
    }

    if (!subs.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, results: [] }), { status: 200, headers: JSONH });
    }

    const settled = await Promise.allSettled(
      subs.map((s) => webpush.sendNotification(s as any, JSON.stringify(payload)))
    );
    const results = settled.map((r, i) =>
      r.status === 'fulfilled'
        ? { index: i, ok: true, status: (r.value as any)?.statusCode }
        : {
            index: i,
            ok: false,
            status: (r.reason as any)?.statusCode || (r.reason as any)?.status || 0,
            error: (r.reason as any)?.body || (r.reason as any)?.message || 'SEND_FAILED',
          }
    );

    return new Response(JSON.stringify({ ok: true, sent: results.filter(r => r.ok).length, results }), { status: 200, headers: JSONH });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), { status: 500, headers: JSONH });
  }
};
