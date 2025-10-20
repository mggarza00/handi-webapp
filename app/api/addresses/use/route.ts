import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: NextRequest) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400, headers: JSONH });
  }

  const addressRaw = (body?.address ?? "").toString();
  const city = typeof body?.city === "string" ? (body.city as string) : null;
  const postal_code = typeof body?.postal_code === "string" ? (body.postal_code as string) : null;
  const label = typeof body?.label === "string" ? (body.label as string) : null;
  const lat = Number.isFinite(Number(body?.lat)) ? Number(body.lat) : null;
  const lon = Number.isFinite(Number(body?.lon)) ? Number(body.lon) : null;
  const address = addressRaw.trim();
  if (!address) {
    return NextResponse.json({ ok: false, error: "ADDRESS_REQUIRED" }, { status: 422, headers: JSONH });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id || null;
  if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

  // Use RPC for atomic upsert keyed by normalized address (unaccent/lower/md5)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = await (supabase as any).rpc("upsert_user_address_book", {
    p_address: address,
    p_city: city ?? null,
    p_lat: lat ?? null,
    p_lon: lon ?? null,
    p_postal_code: postal_code ?? null,
    p_label: label ?? null,
  });
  if (r?.error) {
    return NextResponse.json({ ok: false, error: r.error?.message || "UPSERT_FAILED" }, { status: 400, headers: JSONH });
  }
  const id = r?.data ?? null;
  if (!id) return NextResponse.json({ ok: false, error: "UPSERT_FAILED" }, { status: 400, headers: JSONH });
  return NextResponse.json({ ok: true, id }, { status: 200, headers: JSONH });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
