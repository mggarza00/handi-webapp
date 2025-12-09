// supabase/functions/requests-auto-start/index.ts
// Deno Edge Function: Transición automática a 'in_process' para requests agendadas.
// Corre idealmente cada hora vía cron (configurar en Supabase Dashboard → Edge Functions → Schedule).

import 'jsr:supabase/functions-js/edge-runtime.d.ts';

type RequestRow = {
  id: string;
  status: string;
  scheduled_date: string | null; // YYYY-MM-DD
  scheduled_time: string | null; // HH:MM:SS or null
  timezone: string | null;
};

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  // edge runtime has a global supabase client factory via Deno env? Use fetch to REST instead of JS client
  // We'll use the REST endpoint directly to avoid bundling extra deps.
  const rest = (path: string, init: RequestInit = {}) =>
    fetch(`${url}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(init.headers || {}),
      },
    });
  return { rest };
}

function getLocalParts(tz: string | null) {
  const timeZone = tz && tz.trim().length ? tz : 'America/Mexico_City';
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const pick = (type: string) => (parts.find((p) => p.type === type)?.value || '').padStart(2, '0');
  const y = parts.find((p) => p.type === 'year')?.value || '0000';
  const m = pick('month');
  const d = pick('day');
  const h = pick('hour');
  const min = pick('minute');
  const ymd = `${y}-${m}-${d}`;
  const minutes = Number(h) * 60 + Number(min);
  return { ymd, minutes };
}

function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export default async (req: Request) => {
  try {
    const { rest } = adminClient();
    // Fetch candidates: status='scheduled' and scheduled_date around today (UTC) to reduce volume
    const todayUtc = new Date().toISOString().slice(0, 10);
    const r = await rest(
      `/requests?select=id,status,scheduled_date,scheduled_time,timezone&status=eq.scheduled&scheduled_date=gte.${todayUtc}&scheduled_date=lte.${todayUtc}`,
      { method: 'GET' },
    );
    if (!r.ok) return new Response(JSON.stringify({ ok: false, error: 'FETCH_FAILED' }), { status: 500 });
    const rows = (await r.json()) as RequestRow[];
    const toUpdate: string[] = [];
    for (const row of rows) {
      const { ymd, minutes } = getLocalParts(row.timezone);
      if (!row.scheduled_date || row.scheduled_date !== ymd) continue; // only today in local tz
      const threshold = parseTimeToMinutes(row.scheduled_time) ?? 8 * 60; // 08:00 default
      if (minutes >= threshold) toUpdate.push(row.id);
    }
    if (toUpdate.length) {
      const payload = { status: 'in_process', in_process_at: new Date().toISOString() } as Record<string, unknown>;
      const upd = await rest(`/requests?id=in.(${toUpdate.map((id) => `'${id}'`).join(',')})&status=eq.scheduled`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { Prefer: 'resolution=merge-duplicates' },
      });
      if (!upd.ok) {
        const txt = await upd.text();
        return new Response(JSON.stringify({ ok: false, error: 'UPDATE_FAILED', detail: txt }), { status: 500 });
      }
      // Insertar mensajes de sistema idempotentes por cada request actualizada
      for (const rid of toUpdate) {
        // Resolver conversación y cliente
        const convRes = await rest(`/conversations?select=id,customer_id&request_id=eq.${rid}&order=last_message_at.desc&limit=1`);
        if (!convRes.ok) continue;
        const convRows = (await convRes.json()) as Array<{ id: string; customer_id: string }>;
        const conv = Array.isArray(convRows) && convRows.length ? convRows[0] : null;
        if (!conv?.id || !conv.customer_id) continue;
        // Idempotencia: evitar duplicado si ya existe mensaje "in_process"
        const existing = await rest(`/messages?select=id&conversation_id=eq.${conv.id}&message_type=eq.system&payload=cs.${encodeURIComponent(JSON.stringify({ request_id: rid, status: 'in_process' }))}&limit=1`);
        if (!existing.ok) continue;
        const exRows = (await existing.json()) as Array<{ id: string }>;
        if (Array.isArray(exRows) && exRows.length) continue;
        // Insertar mensaje
        await rest(`/messages`, {
          method: 'POST',
          body: JSON.stringify({
            conversation_id: conv.id,
            sender_id: conv.customer_id,
            body: '🟢 Servicio en proceso.',
            message_type: 'system',
            payload: { request_id: rid, status: 'in_process' },
          }),
        });
      }
    }
    return new Response(JSON.stringify({ ok: true, updated: toUpdate.length }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), { status: 500 });
  }
};
