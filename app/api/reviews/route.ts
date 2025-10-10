import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getAdminSupabase } from '@/lib/supabase/admin';
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
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { requestId, reviewerRole, rating, comment, professionalId, clientId, photos } = parsed.data;

    const userClient = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await userClient.auth.getUser();
    const me = auth?.user?.id ?? null;
    if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    // Validación de pertenencia (participante del request)
    const admin = getAdminSupabase() as any;
    const { data: reqRow } = await admin
      .from('requests')
      .select('id, created_by')
      .eq('id', requestId)
      .maybeSingle();
    const ownerId = (reqRow as any)?.created_by as string | undefined;
    if (!ownerId) return NextResponse.json({ error: 'REQUEST_NOT_FOUND' }, { status: 404 });

    // Resolver contraparte
    let toUserId: string | null = null;
    if (reviewerRole === 'client') {
      toUserId = professionalId ?? null;
    } else {
      toUserId = clientId ?? ownerId;
    }
    if (!toUserId) return NextResponse.json({ error: 'MISSING_COUNTERPART' }, { status: 400 });

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
    if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    // Guardar rating
    const ins = await admin
      .from('ratings')
      .insert({ request_id: requestId, from_user_id: me, to_user_id: toUserId, stars: rating, comment: comment ?? null })
      .select('id')
      .single();
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });

    // Guardar fotos (opcional) en request_photos
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

    return NextResponse.json({ ok: true, id: (ins.data as any)?.id ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

