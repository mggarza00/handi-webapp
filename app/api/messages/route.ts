import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserOrThrow } from "@/lib/_supabase-server";
import { notifyMessageReceived } from "@/lib/notifications";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;


// Reglas de candado (Documento Maestro §5)
const emailRe = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phoneRe = /(\+?\d{1,3}[\s-]?)?(\(?\d{2,3}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}/i;
const urlRe = /\b((https?:\/\/)|www\.)\S+/i;
const addrRe = /\b(calle|avenida|col\.?|cp|codigo postal|#|no\.?|número)\b/i;

function violatesCandado(text: string): boolean {
  return emailRe.test(text) || phoneRe.test(text) || urlRe.test(text) || addrRe.test(text);
}

const BodySchema = z.object({
  request_id: z.string().uuid(),
  to_user_id: z.string().uuid(),
  text: z.string().min(1).max(2000),
});

// GET /api/messages?request_id=uuid&limit=50&before=ISO
export async function GET(req: Request) {
  try {
    const { supabase } = await getUserOrThrow();

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("request_id");
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "50")));
    const before = searchParams.get("before");

    if (!requestId) {
      return NextResponse.json({ ok: false, error: "MISSING_REQUEST_ID" }, { status: 400, headers: JSONH });
    }

    let query = supabase
      .from("messages")
      .select("id, request_id, sender_id, recipient_id, text, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) query = query.lt("created_at", before);

    const { data, error } = await query;
    if (error) {
      const status = /permission|rls/i.test(error.message) ? 403 : 400;
      return NextResponse.json({ ok: false, error: "LIST_FAILED", detail: error.message }, { status, headers: JSONH });
    }

    return NextResponse.json({ ok: true, data: data ?? [] }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ ok: false, error: msg }, { status: 401, headers: JSONH });
  }
}

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
    }

    const { supabase, user } = await getUserOrThrow();
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });
    }

    const body = parsed.data;
    if (body.to_user_id === user.id) {
      return NextResponse.json({ ok: false, error: "CANNOT_MESSAGE_SELF" }, { status: 400, headers: JSONH });
    }
    if (violatesCandado(body.text)) {
      return NextResponse.json({ ok: false, error: "PERSONAL_DATA_BLOCKED", message: "No puedes compartir datos personales en el chat." }, { status: 422, headers: JSONH });
    }

    // Verificar relación válida mediante applications visible por RLS
    const { data: apps, error: appsErr } = await supabase
      .from("applications")
      .select("id, professional_id, request_id")
      .eq("request_id", body.request_id)
      .in("professional_id", [user.id, body.to_user_id]);

    if (appsErr) {
      return NextResponse.json({ ok: false, error: "RELATION_CHECK_FAILED", detail: appsErr.message }, { status: 400, headers: JSONH });
    }
    if (!apps || apps.length === 0) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN", detail: "No autorizado para chatear en esta solicitud." }, { status: 403, headers: JSONH });
    }

    const insert = {
      request_id: body.request_id,
      sender_id: user.id,
      recipient_id: body.to_user_id,
      text: body.text,
    } as unknown as Record<string, unknown>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("messages")
      .insert(insert)
      .select("id, created_at")
      .single();

    if (error) {
      const status = /permission|rls/i.test(error.message) ? 403 : 400;
      return NextResponse.json({ ok: false, error: "MESSAGE_CREATE_FAILED", detail: error.message }, { status, headers: JSONH });
    }

    try {
      await notifyMessageReceived({ request_id: body.request_id, to_user_id: body.to_user_id, text: body.text });
    } catch {
      // no-op
    }
    return NextResponse.json({ ok: true, data }, { status: 201, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ ok: false, error: msg }, { status: 401, headers: JSONH });
  }
}

