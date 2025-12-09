/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } as const;

function onlyDigits(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

// CLABE check: 18 digits, last digit is a checksum of first 17 with weights [3,7,1] cycling
function isValidClabe(raw: string): boolean {
  const clabe = onlyDigits(raw);
  if (clabe.length !== 18) return false;
  if (!/^\d{18}$/.test(clabe)) return false;
  const weights = [3, 7, 1] as const;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const d = clabe.charCodeAt(i) - 48;
    const w = weights[i % 3];
    const prod = (d * w) % 10;
    sum += prod;
  }
  const check = (10 - (sum % 10)) % 10;
  const last = clabe.charCodeAt(17) - 48;
  return check === last;
}

export async function GET(_req: Request) {
  try {
    const supabase = createClient();
    const db = supabase as any;
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (authErr || !user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    // Prefer confirmed; fallback to latest
    const confirmed = await db
      .from("bank_accounts")
      .select("id, profile_id, account_holder_name, bank_name, rfc, clabe, account_type, verification_document_url, status, verified_at, created_at, updated_at")
      .eq("profile_id", user.id)
      .eq("status", "confirmed")
      .maybeSingle();
    if (confirmed?.data) {
      return NextResponse.json({ ok: true, account: confirmed.data, hasConfirmed: true }, { status: 200, headers: JSONH });
    }

    const latest = await db
      .from("bank_accounts")
      .select("id, profile_id, account_holder_name, bank_name, rfc, clabe, account_type, verification_document_url, status, verified_at, created_at, updated_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json(
      { ok: true, account: latest?.data ?? null, hasConfirmed: false },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });

    const supabase = createClient();
    const db = supabase as any;
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (authErr || !user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const account_holder_name = String(body["account_holder_name"] || "").trim();
    const bank_name = String(body["bank_name"] || "").trim();
    const rfc = String(body["rfc"] || "").trim().toUpperCase();
    const account_type = String(body["account_type"] || "").trim();
    const verification_document_url = String(body["verification_document_url"] || "").trim() || null;
    const clabeRaw = String(body["clabe"] || "");
    const clabe = onlyDigits(clabeRaw);

    if (!account_holder_name)
      return NextResponse.json({ ok: false, error: "MISSING_NAME" }, { status: 400, headers: JSONH });
    if (!isValidClabe(clabe))
      return NextResponse.json({ ok: false, error: "INVALID_CLABE" }, { status: 422, headers: JSONH });

    // Upsert strategy: update latest non-archived non-confirmed; else insert pending
    const existing = await db
      .from("bank_accounts")
      .select("id, status")
      .eq("profile_id", user.id)
      .in("status", ["pending", "rejected"]) // editable states
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Upsert or insert pending row
    let targetId: string | null = null;
    if (existing?.data?.id) {
      const upd = await db
        .from("bank_accounts")
        .update({
          account_holder_name,
          bank_name: bank_name || null,
          rfc: rfc || null,
          account_type: account_type || null,
          verification_document_url,
          clabe,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id)
        .select("id")
        .single();
      if (upd.error)
        return NextResponse.json({ ok: false, error: upd.error.message }, { status: 400, headers: JSONH });
      targetId = upd.data?.id ?? null;
    } else {
      const ins = await db
        .from("bank_accounts")
        .insert({
          profile_id: user.id,
          account_holder_name,
          bank_name: bank_name || null,
          rfc: rfc || null,
          account_type: account_type || null,
          verification_document_url,
          clabe,
          status: "pending",
        })
        .select("id")
        .single();
      if (ins.error)
        return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400, headers: JSONH });
      targetId = ins.data?.id ?? null;
    }

    if (!targetId) return NextResponse.json({ ok: false, error: "INSERT_FAILED" }, { status: 400, headers: JSONH });

    // Archive confirmed and promote this one to confirmed (enforce one confirmed per profile)
    const { error: archErr } = await db
      .from("bank_accounts")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("profile_id", user.id)
      .eq("status", "confirmed");
    if (archErr) return NextResponse.json({ ok: false, error: archErr.message }, { status: 400, headers: JSONH });

    const { data: confirmed, error: confErr } = await db
      .from("bank_accounts")
      .update({ status: "confirmed", verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", targetId)
      .select("id, profile_id, account_holder_name, bank_name, rfc, clabe, status, verified_at, created_at, updated_at")
      .single();
    if (confErr) return NextResponse.json({ ok: false, error: confErr.message }, { status: 400, headers: JSONH });

    return NextResponse.json({ ok: true, account: confirmed }, { status: 201, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
