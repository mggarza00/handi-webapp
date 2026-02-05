/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { finalizeOfferPayment } from "@/lib/payments/finalize-offer-payment";
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
    const finalize = await finalizeOfferPayment({
      offerId,
      source: "sync",
    });
    if (!finalize.ok) {
      return NextResponse.json(
        { ok: false, error: "FINALIZE_FAILED" },
        { status: 500, headers: JSONH },
      );
    }
    return NextResponse.json({ ok: true, finalize }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'INTERNAL_ERROR';
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
