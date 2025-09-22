/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );

    let usedDevFallback = false;
    let { user } = await getDevUserFromHeader(req) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDevFallback = true;
    const supabase = usedDevFallback ? (createServiceClient() as any) : await getDbClientForRequest(req);
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    const { conversationId, body } = parsed.data;

    // Validar participación con Service Role (comprobación explícita de pertenencia)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conv = await (supabase as any)
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv.data)
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN_OR_NOT_FOUND" },
        { status: 403, headers: JSONH },
      );

    // Insertar mensaje (RLS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = await (supabase as any)
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, body })
      .select("id, created_at")
      .single();
    if (ins.error)
      return NextResponse.json(
        { ok: false, error: "MESSAGE_CREATE_FAILED", detail: ins.error.message },
        { status: 400, headers: JSONH },
      );

    // Actualizar last_message_at (RLS permite a participantes)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json(
      { ok: true, data: ins.data },
      { status: 201, headers: JSONH },
    );
  } catch (e) {
    const anyE = e as unknown as { status?: number; code?: string; message?: string; stack?: string };
    const msg = anyE?.code || (e instanceof Error ? e.message : "INTERNAL_ERROR");
    const isAuthErr = msg === "UNAUTHORIZED" || msg === "MISSING_AUTH" || msg === "INVALID_TOKEN";
    const status = typeof anyE?.status === "number" ? anyE.status : isAuthErr ? 401 : 500;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("/api/chat/send error:", e);
    }
    return NextResponse.json(
      { ok: false, error: msg, detail: process.env.NODE_ENV !== "production" ? anyE?.stack || null : undefined },
      { status, headers: JSONH },
    );
  }
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
