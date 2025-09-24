/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const QuerySchema = z.object({
  conversationId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  try {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    let usedDevFallback = false;
    let { user } = await getDevUserFromHeader(req) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDevFallback = true;
    const supabase = usedDevFallback ? (createServiceClient() as any) : await getDbClientForRequest(req);
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
    // Obtener participantes para poder derivar "otro" usuario en el cliente
    const conv = await (supabase as any)
      .from("conversations")
      .select("id, customer_id, pro_id, request_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv.data)
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN_OR_NOT_FOUND" },
        { status: 403, headers: JSONH },
      );

    let q = (supabase as any)
      .from("messages")
      .select("id, conversation_id, sender_id, body, text, created_at, read_by, message_type, payload")
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
      read_by: Array.isArray(m.read_by) ? m.read_by.map((x: unknown) => String(x)) : [],
      message_type: (m as any).message_type ?? null,
      payload: (m as any).payload ?? null,
    }));

    // Marcar como leídos los mensajes del otro participante (agregar nuestro user.id a read_by)
    const toMark = normalized.filter((m) => m.sender_id !== user.id && !m.read_by.includes(user.id));
    if (toMark.length) {
      await Promise.allSettled(
        toMark.map((m) =>
          (supabase as any)
            .from("messages")
            .update({ read_by: [...m.read_by, user.id] })
            .eq("id", m.id),
        ),
      );
    }

    return NextResponse.json({
      ok: true,
      data: normalized,
      participants: { customer_id: conv.data.customer_id, pro_id: conv.data.pro_id },
      request_id: conv.data.request_id,
    }, { headers: JSONH });
  } catch (e) {
    const anyE = e as unknown as { status?: number; code?: string; message?: string; stack?: string };
    const msg = anyE?.code || (e instanceof Error ? e.message : "UNAUTHORIZED");
    const isAuthErr = msg === "UNAUTHORIZED" || msg === "MISSING_AUTH" || msg === "INVALID_TOKEN";
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("/api/chat/history error:", e);
    }
    // In dev, avoid 401 so the UI doesn't redirect/logout; return empty history
    if (isAuthErr && process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        { ok: true, data: [], participants: null },
        { headers: JSONH },
      );
    }
    const status = typeof anyE?.status === "number" ? anyE.status : isAuthErr ? 401 : 500;
    return NextResponse.json(
      { ok: false, error: msg, detail: process.env.NODE_ENV !== "production" ? anyE?.stack || null : undefined },
      { status, headers: JSONH },
    );
  }
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
