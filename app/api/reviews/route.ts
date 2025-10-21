import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { Database } from '@/types/supabase';

const Body = z.object({
  requestId: z.string().uuid(),
  reviewerRole: z.enum(['client', 'pro']),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(400).optional(),
  professionalId: z.string().uuid().optional(), // required if reviewerRole = client
  clientId: z.string().uuid().optional(), // required if reviewerRole = pro
  photos: z
    .array(
      z.object({
        path: z.string().min(3),
        thumb_path: z.string().min(3).optional(),
        size_bytes: z.number().int().nonnegative().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      }),
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: JSONH });
    const { requestId, reviewerRole, rating, comment, professionalId, clientId, photos } = parsed.data;

    const userClient = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await userClient.auth.getUser();
    const me = auth?.user?.id ?? null;
    if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: JSONH });

    // Validación de pertenencia (participante del request)
    const admin = getAdminSupabase() as any;
    const { data: reqRow } = await admin
      .from('requests')
      .select('id, created_by')
      .eq('id', requestId)
      .maybeSingle();
    const ownerId = (reqRow as any)?.created_by as string | undefined;
    if (!ownerId) return NextResponse.json({ error: 'REQUEST_NOT_FOUND' }, { status: 404, headers: JSONH });

    // Resolver contraparte
    let toUserId: string | null = null;
    if (reviewerRole === 'client') {
      toUserId = professionalId ?? null;
    } else {
      toUserId = clientId ?? ownerId;
    }
    if (!toUserId) return NextResponse.json({ error: 'MISSING_COUNTERPART' }, { status: 400, headers: JSONH });

    // Comprobar que el revisor es efectivamente parte (cliente dueño o pro con conversación)
    let allowed = me === ownerId;
    if (!allowed) {
      const { data: convs } = await admin
        .from('conversations')
        .select('id')
        .eq('request_id', requestId)
        .or(`customer_id.eq.${me},pro_id.eq.${me}`)
        .limit(1);
      allowed = Array.isArray(convs) && convs.length > 0;
    }
    if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers: JSONH });

    // Evitar duplicados por (request_id, from_user_id)
    const { data: exists } = await admin
      .from('ratings')
      .select('id')
      .eq('request_id', requestId)
      .eq('from_user_id', me)
      .limit(1);
    if (Array.isArray(exists) && exists.length) {
      return NextResponse.json({ error: 'DUPLICATE_REVIEW' }, { status: 409, headers: JSONH });
    }

    // Guardar rating
    const ins = await admin
      .from('ratings')
      .insert({ request_id: requestId, from_user_id: me, to_user_id: toUserId, stars: rating, comment: comment ?? null })
      .select('id')
      .single();
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400, headers: JSONH });

    // Guardar fotos (opcional) en request_photos (se asume que ya fueron subidas a Storage y enviamos sus paths)
    if (Array.isArray(photos) && photos.length) {
      const rows = photos.map((p) => ({
        request_id: requestId,
        path: p.path,
        thumb_path: p.thumb_path ?? null,
        size_bytes: p.size_bytes ?? null,
        width: p.width ?? null,
        height: p.height ?? null,
        created_by: me,
      }));
      await admin.from('request_photos').insert(rows as any);
    }

    // Condición de cierre: si existen reseñas de ambas partes (dueño y pro), marcar completed
    try {
      const { data: conv } = await admin
        .from('conversations')
        .select('customer_id, pro_id, id')
        .eq('request_id', requestId)
        .order('last_message_at', { ascending: false })
        .maybeSingle();
      const customerId = (conv as any)?.customer_id as string | undefined;
      const proUserId = (conv as any)?.pro_id as string | undefined;
      if (customerId && proUserId) {
        const { data: both } = await admin
          .from('ratings')
          .select('from_user_id')
          .eq('request_id', requestId);
        const set = new Set<string>((both || []).map((r: any) => String(r.from_user_id)));
        if (set.has(customerId) && set.has(proUserId)) {
          // marcar como finished (UI = completed)
          await admin.from('requests').update({ status: 'finished' } as any).eq('id', requestId);
          // espejo en calendario
          try {
            await (admin as any).from('pro_calendar_events').upsert({ request_id: requestId, status: 'finished' }, { onConflict: 'request_id' });
          } catch { /* ignore */ }
          try {
            revalidatePath(`/requests/${requestId}`);
            revalidatePath('/pro/calendar');
            revalidateTag('pro-calendar');
            if ((conv as any)?.id) revalidatePath(`/mensajes/${(conv as any).id}`);
          } catch { /* ignore */ }
        } else {
          // al menos refrescar vistas si sólo una reseña
          try {
            revalidatePath(`/requests/${requestId}`);
            revalidatePath('/pro/calendar');
            revalidateTag('pro-calendar');
            if ((conv as any)?.id) revalidatePath(`/mensajes/${(conv as any).id}`);
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, id: (ins.data as any)?.id ?? null }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}
const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
