import { NextResponse } from 'next/server';
import getRouteClient from '@/lib/supabase/route-client';
import type { Database } from '@/types/supabase';

const JSONH = { 'Content-Type': 'application/json; charset=utf-8' } as const;

export const dynamic = 'force-dynamic';

async function getUserId() {
  const supa = getRouteClient();
  const { data: auth } = await supa.auth.getUser();
  return auth?.user?.id ?? null;
}

export async function GET() {
  try {
    const supa = getRouteClient();
    const { data: auth } = await supa.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ ok: true, enabled: true }, { status: 200, headers: JSONH });
    const { data } = await supa
      .from('profiles')
      .select('email_chat_notifications_enabled')
      .eq('id', userId)
      .maybeSingle();
    const enabled = (data as any)?.email_chat_notifications_enabled !== false;
    return NextResponse.json({ ok: true, enabled }, { status: 200, headers: JSONH });
  } catch (e) {
    return NextResponse.json({ ok: true, enabled: true }, { status: 200, headers: JSONH });
  }
}

export async function PATCH(req: Request) {
  try {
    const ct = (req.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) return NextResponse.json({ ok: false, error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415, headers: JSONH });
    const supa = getRouteClient();
    const { data: auth } = await supa.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401, headers: JSONH });
    const body = await req.json().catch(() => ({}));
    const enabled = Boolean((body as any)?.enabled !== false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = supa as any;
    await db.from('profiles').update({ email_chat_notifications_enabled: enabled as any }).eq('id', userId);
    return NextResponse.json({ ok: true, enabled }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
  }
}
