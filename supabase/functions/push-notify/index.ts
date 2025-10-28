// supabase/functions/push-notify/index.ts
// Optional Edge Function to send Web Push notifications from Supabase backend.
// NOTE: Implementing VAPID signing in Deno requires a Deno-compatible library.
// For now, this skeleton validates input and (optionally) can forward to a
// server route if you set HANDI_PUSH_PROXY_URL to a trusted internal endpoint
// (e.g., your Next.js /api/web-push/send running in the same VPC).

import 'jsr:supabase/functions-js/edge-runtime.d.ts';

type Keys = { p256dh: string; auth: string };
type Subscription = { endpoint: string; keys: Keys };

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

export default async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), { status: 405 });
    }
    const body = await req.json().catch(() => ({})) as {
      user_id?: string;
      subscription?: Subscription;
      payload?: Payload;
    };

    const proxyUrl = Deno.env.get('HANDI_PUSH_PROXY_URL');
    if (proxyUrl) {
      const r = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body.payload || {}),
      });
      const text = await r.text();
      return new Response(text, { status: r.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }

    // Not implemented without a Deno web push library.
    return new Response(
      JSON.stringify({ ok: false, error: 'NOT_IMPLEMENTED', detail: 'Set HANDI_PUSH_PROXY_URL to a trusted /api/web-push/send endpoint or bring a Deno web-push library.' }),
      { status: 501, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
};

