import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { ok: false, error: "supabase_misconfigured", detail: "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500, headers: JSON_HEADERS }
      );
    }

    // SERVICE ROLE (no persistir sesión)
    const sb = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

    // 1) Crear dos usuarios de prueba (client y pro)
    const ts = Date.now();
    const clientEmail = `client+${ts}@handee.test`;
    const proEmail = `pro+${ts}@handee.test`;

    const clientRes = await sb.auth.admin.createUser({ email: clientEmail, email_confirm: true });
    if (clientRes.error) throw clientRes.error;
    const proRes = await sb.auth.admin.createUser({ email: proEmail, email_confirm: true });
    if (proRes.error) throw proRes.error;

    const clientId = clientRes.data.user.id;
    const proId = proRes.data.user.id;

    // 2) Crear REQUEST mínima (title, created_by obligatorios)
    const reqIns = await sb.from("requests").insert({
      title: "Demo request (seed)",
      description: "Generada por /api/_debug/seed-agreement",
      city: "Monterrey",
      category: "general",
      created_by: clientId,
    }).select("id").single();
    if (reqIns.error) throw reqIns.error;
    const requestId = reqIns.data.id as string;

    // 3) Crear AGREEMENT atado al request + pro (FKs)
    const agrIns = await sb.from("agreements").insert({
      request_id: requestId,
      professional_id: proId,
      amount: 50,
    }).select("id,status,request_id,professional_id").single();
    if (agrIns.error) throw agrIns.error;

    return NextResponse.json(
      {
        ok: true,
        client_user: { id: clientId, email: clientEmail },
        pro_user: { id: proId, email: proEmail },
        request: { id: requestId },
        agreement: agrIns.data,
      },
      { status: 201, headers: JSON_HEADERS }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unexpected_error";
    return NextResponse.json({ ok: false, error: "seed_failed", detail: msg }, { status: 500, headers: JSON_HEADERS });
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: JSON_HEADERS }
  );
}
