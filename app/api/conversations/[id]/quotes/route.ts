import { NextResponse } from "next/server";
import { z } from "zod";

import { getDbClientForRequest, getUserFromRequestOrThrow, getDevUserFromHeader } from "@/lib/auth-route";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const ItemSchema = z.object({
  concept: z.string().min(1).max(200),
  amount: z.coerce.number().finite().nonnegative(),
});

const BodySchema = z.object({
  currency: z.string().trim().toUpperCase().default("MXN"),
  items: z.array(ItemSchema).min(1),
  total: z.coerce.number().finite().positive().optional(),
  image_path: z.string().trim().optional(),
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
      .select("id, customer_id, pro_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });
    if (String(conv.pro_id) !== user.id)
      return NextResponse.json({ ok: false, error: "ONLY_PRO_CAN_QUOTE" }, { status: 403, headers: JSONH });

    const body = BodySchema.parse(await req.json());
    const computedTotal = body.items.reduce((acc, it) => acc + Number(it.amount || 0), 0);
    const total = typeof body.total === "number" && Number.isFinite(body.total) && body.total > 0 ? body.total : computedTotal;

    const ins = await (supabase as any)
      .from("quotes")
      .insert({
        conversation_id: conversationId,
        professional_id: user.id,
        client_id: conv.customer_id,
        currency: body.currency || "MXN",
        items: body.items,
        total,
        image_path: body.image_path || null,
        status: 'sent',
      })
      .select("id")
      .single();
    if (!ins?.data) {
      const msg = (ins?.error as any)?.message || "QUOTE_CREATE_FAILED";
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

