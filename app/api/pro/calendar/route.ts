import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    // 1) Intentar pro_calendar_events
    try {
      const { data, error } = await (supabase as any)
        .from('pro_calendar_events')
        .select('request_id, pro_id, title, scheduled_date, scheduled_time, status')
        .eq('pro_id', user.id)
        .order('scheduled_date', { ascending: true, nullsFirst: false });
      if (!error && Array.isArray(data) && data.length) {
        return NextResponse.json({ ok: true, source: 'pro_calendar_events', items: data });
      }
    } catch { /* ignore */ }

    // 2) Fallback directo a requests (compatible con professional_id o accepted_professional_id)
    try {
      // prefer accepted_professional_id si existe; caso contrario professional_id
      let { data, error } = await (supabase as any)
        .from('requests')
        .select('id, title, status, scheduled_date, scheduled_time, accepted_professional_id')
        .eq('accepted_professional_id', user.id)
        .in('status', ['scheduled', 'in_process']);
      if (error) {
        const alt = await (supabase as any)
          .from('requests')
          .select('id, title, status, scheduled_date, scheduled_time, professional_id')
          .eq('professional_id', user.id)
          .in('status', ['scheduled', 'in_process']);
        data = alt.data;
      }
      const items = (data || []).map((r: any) => ({
        request_id: r.id,
        pro_id: user.id,
        title: r.title || 'Servicio',
        scheduled_date: r.scheduled_date || null,
        scheduled_time: r.scheduled_time || null,
        status: r.status || null,
      }));
      return NextResponse.json({ ok: true, source: 'requests', items });
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, source: 'empty', items: [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

