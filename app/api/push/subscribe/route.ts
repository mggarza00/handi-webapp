import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

const JSONH = { 'Content-Type': 'application/json; charset=utf-8' } as const;

type Keys = { p256dh: string; auth: string };
type Subscription = { endpoint: string; expirationTime?: number | null; keys: Keys };

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401, headers: JSONH });
    }

    const body = (await req.json().catch(() => ({}))) as { subscription?: Subscription };
    const sub = body?.subscription as Subscription | undefined;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ ok: false, error: 'INVALID_SUBSCRIPTION' }, { status: 400, headers: JSONH });
    }

    // Use JSONB keys column as requested
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supaAny = supabase as any;
    const { error } = await supaAny
      .from('web_push_subscriptions')
      .upsert({ user_id: user.id, endpoint: sub.endpoint, keys: sub.keys }, { onConflict: 'endpoint' });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500, headers: JSONH });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

