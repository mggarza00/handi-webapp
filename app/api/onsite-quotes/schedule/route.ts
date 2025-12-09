import { NextResponse } from "next/server";
import { z } from "zod";

import { getDevUserFromHeader, getUserFromRequestOrThrow } from "@/lib/auth-route";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  conversation_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_start: z.coerce.number().int().min(0).max(23),
  time_end: z.coerce.number().int().min(1).max(24),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
    let user = (await getDevUserFromHeader(req))?.user ?? null;
    if (!user) ({ user } = await getUserFromRequestOrThrow(req));
    const admin = createServerClient();
    const body = BodySchema.parse(await req.json());
    const { conversation_id, date, time_start, time_end, notes } = body;
    if (!(time_end > time_start))
      return NextResponse.json({ ok: false, error: "INVALID_SCHEDULE_RANGE" }, { status: 422, headers: JSONH });

    // Validate client participation
    const { data: conv } = await admin
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", conversation_id)
      .maybeSingle();
    const convRow = (conv as unknown as { customer_id?: string; pro_id?: string } | null);
    if (!convRow) return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });
    if (String(convRow.customer_id) !== user.id)
      return NextResponse.json({ ok: false, error: "ONLY_CLIENT_CAN_SCHEDULE" }, { status: 403, headers: JSONH });

    // Upsert onsite_quote_requests by conversation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sel: any = await (admin as any)
      .from("onsite_quote_requests")
      .select("id,status")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = sel?.data as unknown as Array<{ id?: string }>|null;
    const existingRow = Array.isArray(existing) && existing.length ? (existing[0] as any) : null;
    if (existingRow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("onsite_quote_requests")
        .update({
          status: "scheduled",
          schedule_date: date,
          schedule_time_start: time_start,
          schedule_time_end: time_end,
          notes: notes || null,
        })
        .eq("id", existingRow.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("onsite_quote_requests")
        .insert({
          conversation_id,
          request_id: null,
          professional_id: convRow.pro_id,
          client_id: convRow.customer_id,
          status: "scheduled",
          schedule_date: date,
          schedule_time_start: time_start,
          schedule_time_end: time_end,
          notes: notes || null,
          deposit_amount: 200,
        } as any);
    }

    // Trigger handles chat message
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
