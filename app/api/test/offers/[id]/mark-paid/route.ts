/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const hdr = (req.headers.get('x-e2e') || req.headers.get('x-test')) ?? '';
    if (hdr !== '1') return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403, headers: JSONH });
    const offerId = (params?.id || '').trim();
    if (!offerId) return NextResponse.json({ ok: false, error: 'MISSING_OFFER' }, { status: 400, headers: JSONH });
    const admin = getAdminSupabase();
    const { data: offer } = await admin
      .from('offers')
      .select('id, conversation_id, client_id, status')
      .eq('id', offerId)
      .single();
    if (!offer) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404, headers: JSONH });
    await admin.from('offers').update({ status: 'paid' as any }).eq('id', offerId);
    // Insert system paid message (best-effort) similar to /api/offers/:id/paid-message
    try {
      await admin
        .from('messages')
        .insert({
          conversation_id: (offer as any).conversation_id,
          sender_id: (offer as any).client_id,
          body: 'Pago realizado. Servicio agendado.',
          message_type: 'system',
          payload: { offer_id: offerId, status: 'paid' },
        } as any);
    } catch { /* ignore */ }
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'INTERNAL_ERROR';
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
