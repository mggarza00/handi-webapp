import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequestOrThrow, getDbClientForRequest } from "@/lib/auth-route";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const QuerySchema = z.object({
  conversationId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  try {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user } = await getUserFromRequestOrThrow(req);
    const supabase = await getDbClientForRequest(req);
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      conversationId: searchParams.get("conversationId"),
      limit: searchParams.get("limit") ?? undefined,
      before: searchParams.get("before") ?? undefined,
    });
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    const { conversationId, limit = 50, before } = parsed.data;

    // Validar pertenencia a la conversación y leer con Service Role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from("messages")
      .select("id, conversation_id, sender_id, body, text, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) q = q.lt("created_at", before);

    const { data, error } = await q;
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400, headers: JSONH },
      );

    // Normalizar body usando fallback text
    const normalized = (data ?? []).map((m) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      body: (m.body ?? m.text ?? "").toString(),
      created_at: m.created_at,
    }));

    return NextResponse.json({ ok: true, data: normalized }, { headers: JSONH });
  } catch (e) {
    const anyE = e as unknown as { status?: number; code?: string; message?: string; stack?: string };
    const msg = anyE?.code || (e instanceof Error ? e.message : "UNAUTHORIZED");
    const status = typeof anyE?.status === "number" ? anyE.status : msg === "UNAUTHORIZED" ? 401 : 500;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("/api/chat/history error:", e);
    }
    return NextResponse.json(
      { ok: false, error: msg, detail: process.env.NODE_ENV !== "production" ? anyE?.stack || null : undefined },
      { status, headers: JSONH },
    );
  }
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
