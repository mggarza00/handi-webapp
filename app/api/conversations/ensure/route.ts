import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import type { Database as DB } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED:SUPABASE");
  return createClient<DB>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type EnsureInput = {
  requestId: string;
  proId: string;
  redirect?: boolean;
};

async function ensureConversation({ requestId, proId }: { requestId: string; proId: string }) {
  const admin = supaAdmin();
  // Obtener el cliente (dueño de la solicitud)
  const req = await admin
    .from("requests")
    .select("id, created_by")
    .eq("id", requestId)
    .maybeSingle<{ id: string; created_by: string }>();
  if (req.error || !req.data) {
    return { ok: false as const, error: "REQUEST_NOT_FOUND" };
  }
  const customerId = req.data.created_by;

  // Upsert conversación única por (request_id, customer_id, pro_id)
  // NOTE: conversations no está en el esquema generado oficial aún; usamos cast controlado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const up = (await (admin as any)
    .from("conversations")
    .upsert(
      [
        { request_id: requestId, customer_id: customerId, pro_id: proId },
      ],
      { onConflict: "request_id,customer_id,pro_id" },
    )
    .select("id")
    .single()) as { data: { id?: string } | null; error: { message?: string } | null };

  if (up.error || !up.data || typeof up.data.id !== "string") {
    return { ok: false as const, error: up.error?.message || "UPSERT_FAILED" };
  }
  return { ok: true as const, id: up.data.id };
}

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );
    }
    const body = (await req.json().catch(() => ({}))) as Partial<EnsureInput>;
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const proId = typeof body.proId === "string" ? body.proId : "";
    const doRedirect = body.redirect !== false; // por defecto redirige
    if (!requestId || !proId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PARAMS" },
        { status: 400, headers: JSONH },
      );
    }
    const ensured = await ensureConversation({ requestId, proId });
    if (!ensured.ok) {
      return NextResponse.json(
        { ok: false, error: ensured.error },
        { status: 400, headers: JSONH },
      );
    }
    if (doRedirect) {
      const { origin } = new URL(req.url);
      return NextResponse.redirect(new URL(`/mensajes/${ensured.id}`, origin), 303);
    }
    return NextResponse.json({ ok: true, id: ensured.id }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requestId = url.searchParams.get("requestId") || url.searchParams.get("request_id") || "";
    const proId = url.searchParams.get("proId") || url.searchParams.get("pro_id") || "";
    const redirectParam = url.searchParams.get("redirect") || "1";
    const doRedirect = redirectParam === "1" || redirectParam.toLowerCase() === "true";
    if (!requestId || !proId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PARAMS" },
        { status: 400, headers: JSONH },
      );
    }
    const ensured = await ensureConversation({ requestId, proId });
    if (!ensured.ok) {
      return NextResponse.json(
        { ok: false, error: ensured.error },
        { status: 400, headers: JSONH },
      );
    }
    if (doRedirect) {
      const { origin } = new URL(req.url);
      return NextResponse.redirect(new URL(`/mensajes/${ensured.id}`, origin), 303);
    }
    return NextResponse.json({ ok: true, id: ensured.id }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
