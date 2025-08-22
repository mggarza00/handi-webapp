import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400, headers: JSON_HEADERS });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { ok: false, error: "supabase_misconfigured" },
        { status: 500, headers: JSON_HEADERS }
      );
    }

    const sb = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data, error } = await sb.from("agreements").select("id,status,request_id,professional_id,amount").eq("id", id).maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, error: "db_error", detail: error.message }, { status: 500, headers: JSON_HEADERS });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: JSON_HEADERS });
    }
    return NextResponse.json({ ok: true, agreement: data }, { status: 200, headers: JSON_HEADERS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unexpected_error";
    return NextResponse.json({ ok: false, error: "unexpected_failure", detail: msg }, { status: 500, headers: JSON_HEADERS });
  }
}
