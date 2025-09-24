import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({ requestId: z.string().uuid() });

export async function POST(req: Request) {
  try {
    const isE2E = req.headers.get("x-e2e") === "1";
    const allowed = process.env.NODE_ENV !== "production" || process.env.CI === "true";
    if (!isE2E || !allowed) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });
    }

    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });

    const admin = getAdminSupabase();
    const reqId = parsed.data.requestId;

    // 1) Marcar acuerdos del request como paid
    const up1 = await admin
      .from("agreements")
      .update({ status: "paid" })
      .eq("request_id", reqId)
      .in("status", ["accepted", "negotiating"]) // idempotente
      .select("id")
      .limit(1);
    if (up1.error) {
      return NextResponse.json({ ok: false, error: "UPDATE_AGREEMENTS_FAILED", detail: up1.error.message }, { status: 500, headers: JSONH });
    }

    // 2) Mover la solicitud a in_process (idempotente)
    const up2 = await admin
      .from("requests")
      .update({ status: "in_process" })
      .eq("id", reqId)
      .in("status", ["active", "in_process"]) // idempotente
      .select("id")
      .single();
    if (up2.error && up2.error.code !== "PGRST116") {
      return NextResponse.json({ ok: false, error: "UPDATE_REQUEST_FAILED", detail: up2.error.message }, { status: 500, headers: JSONH });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

export function GET() {
  return new NextResponse(
    JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }),
    { status: 405, headers: JSONH },
  );
}

