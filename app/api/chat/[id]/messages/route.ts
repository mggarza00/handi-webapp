/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

const QuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(req: Request, { params }: Ctx) {
  try {
    const id = params.id;
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });
    const { cursor, limit = 50 } = parsed.data;

    let usedDev = false;
    let { user } = await getDevUserFromHeader(req) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDev = true;
    const db: any = usedDev ? createServiceClient() : await getDbClientForRequest(req);

    // Validate membership via conversations
    const conv = await db.from("conversations").select("id, customer_id, pro_id").eq("id", id).maybeSingle();
    if (!conv?.data)
      return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });

    let q = db
      .from("messages")
      .select("id, conversation_id, sender_id, body, text, created_at, read_by")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (cursor) q = q.lt("created_at", cursor);

    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: JSONH });

    const mapped = (data ?? []).map((m: any) => ({
      id: m.id,
      sender_id: m.sender_id,
      body: String((m.body ?? m.text ?? "") as string),
      created_at: m.created_at,
      read_by: Array.isArray(m.read_by) ? (m.read_by as unknown[]).map((x) => String(x)) : [],
    }));
    const nextCursor = mapped.length ? mapped[mapped.length - 1].created_at : null;
    return NextResponse.json({ ok: true, data: mapped, nextCursor }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    return NextResponse.json({ ok: false, error: msg }, { status, headers: JSONH });
  }
}

const BodySchema = z.object({ text: z.string().min(1).max(4000) });

export async function POST(req: Request, { params }: Ctx) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
    const id = params.id;

    let usedDev = false;
    let { user } = await getDevUserFromHeader(req) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDev = true;
    const db: any = usedDev ? createServiceClient() : await getDbClientForRequest(req);

    // Validate membership
    const conv = await db.from("conversations").select("id").eq("id", id).maybeSingle();
    if (!conv?.data)
      return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });

    const { text } = parsed.data;
    const ins = await db
      .from("messages")
      .insert({ conversation_id: id, sender_id: user.id, body: text })
      .select("id, created_at")
      .single();
    if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400, headers: JSONH });

    await db.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, data: ins.data }, { status: 201, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    return NextResponse.json({ ok: false, error: msg }, { status, headers: JSONH });
  }
}
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
