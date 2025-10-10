import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getAdminSupabase } from '@/lib/supabase/admin';
import type { Database } from '@/types/supabase';
import { revalidatePath, revalidateTag } from 'next/cache';

const Body = z.object({
  nextStatus: z.enum(['scheduled', 'in_process', 'completed']),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const requestId = params.id;
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const next = parsed.data.nextStatus;

    const userClient = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await userClient.auth.getUser();
    const me = auth?.user?.id ?? null;
    if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const admin = getAdminSupabase() as any;
    const { data: reqRow } = await admin
      .from('requests')
      .select('id, created_by, status')
      .eq('id', requestId)
      .maybeSingle();
    if (!reqRow) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    const current = String((reqRow as any).status ?? '').toLowerCase();
    const ownerId = String((reqRow as any).created_by ?? '');

    // Permisos: dueño del request o pro participante con conversación
    let allowed = me === ownerId;
    if (!allowed) {
      const { data: convs } = await admin
        .from('conversations')
        .select('id')
        .eq('request_id', requestId)
        .eq('pro_id', me)
        .limit(1);
      allowed = Array.isArray(convs) && convs.length > 0;
    }
    if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    // Mapa de transición simple
    const mapCompletedTo = 'finished';
    const normalizedNext = next === 'completed' ? mapCompletedTo : next;
    // Validar transiciones básicas
    const ok =
      (current === 'active' && (normalizedNext === 'scheduled' || normalizedNext === 'in_process')) ||
      (current === 'scheduled' && (normalizedNext === 'in_process' || normalizedNext === mapCompletedTo)) ||
      (current === 'in_process' && normalizedNext === mapCompletedTo) ||
      // permitir idempotencia
      current === normalizedNext;
    if (!ok) return NextResponse.json({ error: `INVALID_TRANSITION ${current} -> ${normalizedNext}` }, { status: 400 });

    // Aplicar cambio en requests
    const { error: upErr } = await admin
      .from('requests')
      .update({ status: normalizedNext } as any)
      .eq('id', requestId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    // Espejo en calendario del pro (best-effort)
    try {
      const { data: conv } = await admin
        .from('conversations')
        .select('pro_id, id')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })
        .maybeSingle();
      const proId = (conv as any)?.pro_id as string | undefined;
      if (proId) {
        await admin
          .from('pro_calendar_events')
          .upsert({ request_id: requestId, pro_id: proId, title: 'Servicio', status: normalizedNext } as any, {
            onConflict: 'request_id',
          });
      }
      // Revalidar calendario y chat
      try {
        revalidatePath('/pro/calendar');
        revalidateTag('pro-calendar');
        if ((conv as any)?.id) revalidatePath(`/mensajes/${(conv as any).id}`);
      } catch { /* ignore */ }
    } catch { /* ignore */ }

    // Revalidar vistas clave
    try {
      revalidatePath('/requests/explore');
      revalidatePath(`/requests/${requestId}`);
      revalidatePath('/pro/calendar');
      revalidateTag('pro-calendar');
    } catch { /* ignore */ }

    const ui = next; // devolver etiqueta conforme a UI solicitada
    return NextResponse.json({ ok: true, data: { id: requestId, status: ui } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
