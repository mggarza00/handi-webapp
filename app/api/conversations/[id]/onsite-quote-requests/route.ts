import { NextResponse } from "next/server";
import { z } from "zod";

import { getDbClientForRequest, getUserFromRequestOrThrow, getDevUserFromHeader } from "@/lib/auth-route";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  schedule_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  schedule_time_start: z.coerce.number().int().min(0).max(23).optional(),
  schedule_time_end: z.coerce.number().int().min(1).max(24).optional(),
  notes: z.string().max(1000).optional(),
  deposit_amount: z.coerce.number().positive().default(200),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });

    let usedDevFallback = false;
    let { user } = (await getDevUserFromHeader(req)) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDevFallback = true;
    const supabase = usedDevFallback ? await getDbClientForRequest(req) : await getDbClientForRequest(req);

    const conversationId = (params?.id || "").trim();
    if (!conversationId)
      return NextResponse.json({ ok: false, error: "MISSING_CONVERSATION" }, { status: 400, headers: JSONH });

    // Validate user is the pro participant
    const { data: conv } = await (supabase as any)
      .from("conversations")
      .select("id, customer_id, pro_id, request_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });
    if (String(conv.pro_id) !== user.id)
      return NextResponse.json({ ok: false, error: "ONLY_PRO_CAN_REQUEST_ONSITE" }, { status: 403, headers: JSONH });

    const body = BodySchema.parse(await req.json());
    const st = body.schedule_time_start ?? null;
    const en = body.schedule_time_end ?? null;
    if (st != null && en != null && !(en > st))
      return NextResponse.json({ ok: false, error: "INVALID_SCHEDULE_RANGE" }, { status: 422, headers: JSONH });

    const ins = await (supabase as any)
      .from("onsite_quote_requests")
      .insert({
        conversation_id: conversationId,
        request_id: conv.request_id || null,
        professional_id: user.id,
        client_id: conv.customer_id,
        status: 'deposit_pending',
        schedule_date: body.schedule_date || null,
        schedule_time_start: body.schedule_time_start ?? null,
        schedule_time_end: body.schedule_time_end ?? null,
        notes: body.notes || null,
        deposit_amount: body.deposit_amount || 200,
      })
      .select("id")
      .single();
    if (!ins?.data) {
      const msg = (ins?.error as any)?.message || "ONSITE_CREATE_FAILED";
      return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
    }

    return NextResponse.json({ ok: true, id: ins.data.id }, { status: 201, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

