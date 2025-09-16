/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  requestId: z.string().uuid(),
  proId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );

    if (process.env.NODE_ENV !== "production" && process.env.DEBUG_API === "1") {
      const hasCookiePre = !!(req.headers.get("cookie") || "");
      const hasAuthPre = !!(req.headers.get("authorization") || req.headers.get("Authorization"));
      // eslint-disable-next-line no-console
      console.log("/api/chat/start headers:", { hasCookie: hasCookiePre, hasAuth: hasAuthPre });
    }

    // Obtener usuario autenticado (cookies/Bearer) o fallback dev (x-user-id)
    let usedDevFallback = false;
    let { user } = await getDevUserFromHeader(req) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDevFallback = true;
    if (process.env.NODE_ENV !== "production" && process.env.DEBUG_API === "1") {
      const hasCookie = !!(req.headers.get("cookie") || "");
      const hasAuth = !!(req.headers.get("authorization") || req.headers.get("Authorization"));
      // eslint-disable-next-line no-console
      console.log("/api/chat/start auth debug:", { hasCookie, hasAuth, userId: user.id });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    const { requestId, proId } = parsed.data;

    // Si estamos en fallback dev, usar Service Role; si no, RLS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = usedDevFallback ? createServiceClient() : await getDbClientForRequest(req);

    // Obtener dueño de la solicitud para soportar inicio de conversación desde el profesional
    const reqRow = await db
      .from("requests")
      .select("id, created_by")
      .eq("id", requestId)
      .maybeSingle();
    if (reqRow.error || !reqRow.data) {
      return NextResponse.json(
        { ok: false, error: "REQUEST_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }
    const ownerId = reqRow.data.created_by as string;

    // Si el usuario autenticado es el profesional, tratamos como inicio desde pro
    const isProInitiator = user.id === proId;
    const customer_id = isProInitiator ? ownerId : user.id;
    const pro_id = isProInitiator ? user.id : proId;

    const up = await db
      .from("conversations")
      .upsert(
        [
          {
            request_id: requestId,
            customer_id,
            pro_id,
          },
        ],
        { onConflict: "request_id,customer_id,pro_id" },
      )
      .select("id, request_id, customer_id, pro_id, last_message_at, created_at")
      .single();

    if (!up.error && up.data) {
      return NextResponse.json({ ok: true, data: up.data }, { headers: JSONH });
    }
    const detail = up.error?.message || "CONVERSATION_UPSERT_FAILED";
    return NextResponse.json({ ok: false, error: detail }, { status: 400, headers: JSONH });
  } catch (e) {
    const anyE = e as unknown as { status?: number; code?: string; message?: string; stack?: string };
    const msg = anyE?.code || (e instanceof Error ? e.message : "INTERNAL_ERROR");
    const isAuthErr = msg === "UNAUTHORIZED" || msg === "MISSING_AUTH" || msg === "INVALID_TOKEN";
    // Avoid redirect loops in dev by not returning 401 for auth errors
    const status = typeof anyE?.status === "number" ? anyE.status : (isAuthErr && process.env.NODE_ENV !== "production") ? 200 : isAuthErr ? 401 : 500;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("/api/chat/start error:", e);
    }
    return NextResponse.json(
      { ok: false, error: msg, detail: process.env.NODE_ENV !== "production" ? anyE?.stack || null : undefined },
      { status, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
