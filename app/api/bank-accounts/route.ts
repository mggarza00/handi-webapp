import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } as const;

function onlyDigits(s: string): string { return (s || "").replace(/\D+/g, ""); }
function isValidClabe(clabe: string): boolean {
  const s = onlyDigits(clabe);
  if (!/^\d{18}$/.test(s)) return false;
  const w = [3, 7, 1] as const;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += ((s.charCodeAt(i) - 48) * w[i % 3]) % 10;
  const check = (10 - (sum % 10)) % 10;
  return check === (s.charCodeAt(17) - 48);
}

export async function GET() {
  try {
    const supabase = createClient();
    const db = supabase as any;
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const { data: profile } = await db
      .from("profiles")
      .select("role, is_client_pro, full_name")
      .eq("id", user.id)
      .maybeSingle();
    const isPro = (profile?.role as unknown as string) === "professional" || Boolean((profile as unknown as { is_client_pro?: boolean })?.is_client_pro);
    if (!isPro) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    const { data: rows, error: listErr } = await db
      .from("bank_accounts")
      .select("id, bank_name, clabe, status, created_at, verified_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 400, headers: JSONH });

    const items = (rows ?? []).map((r) => {
      const raw = onlyDigits((r as any).clabe || "");
      const first3 = raw.slice(0, 3);
      const last4 = raw.slice(-4);
      const stars = raw ? "*".repeat(Math.max(0, raw.length - 7)) : "";
      const clabe_masked = raw ? `${first3}${stars}${last4}` : null;
      const status = (r as any).status as string | null;
      return {
        id: (r as any).id as string,
        bank_name: (r as any).bank_name as string | null,
        clabe_masked,
        status,
        is_default: status === "confirmed",
        created_at: (r as any).created_at as string | null,
      };
    });
    return NextResponse.json(
      { full_name: (profile as unknown as { full_name?: string | null })?.full_name ?? null, items },
      { headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}

export async function PUT(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });

    const supabase = createClient();
    const db = supabase as any;
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    // Optional gating by role
    const { data: profile } = await db
      .from("profiles")
      .select("role, is_client_pro, full_name")
      .eq("id", user.id)
      .maybeSingle();
    const isPro = (profile?.role as unknown as string) === "professional" || Boolean((profile as unknown as { is_client_pro?: boolean })?.is_client_pro);
    if (!isPro) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: JSONH });
    const fullName = String((profile as unknown as { full_name?: string | null })?.full_name || "").trim();
    if (!fullName)
      return NextResponse.json({ error: "MISSING_FULL_NAME" }, { status: 422, headers: JSONH });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const bank = String(body["bank"] || "").trim();
    const clabe = onlyDigits(String(body["clabe"] || ""));
    if (!bank) return NextResponse.json({ error: "MISSING_BANK" }, { status: 422, headers: JSONH });
    if (!/^\d{18}$/.test(clabe) || !isValidClabe(clabe)) return NextResponse.json({ error: "INVALID_CLABE" }, { status: 422, headers: JSONH });

    // Upsert editable row: pending/rejected else insert; then promote to confirmed and archive previous confirmed
    const existing = await db
      .from("bank_accounts")
      .select("id, status")
      .eq("profile_id", user.id)
      .in("status", ["pending", "rejected"]) // editable states
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let targetId: string | null = null;
    if (existing?.data?.id) {
      const upd = await db
        .from("bank_accounts")
        .update({
          account_holder_name: fullName,
          bank_name: bank,
          clabe,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id)
        .select("id")
        .single();
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400, headers: JSONH });
      targetId = upd.data?.id ?? null;
    } else {
      const ins = await db
        .from("bank_accounts")
        .insert({
          profile_id: user.id,
          account_holder_name: fullName,
          bank_name: bank,
          clabe,
          status: "pending",
        })
        .select("id")
        .single();
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400, headers: JSONH });
      targetId = ins.data?.id ?? null;
    }

    if (!targetId) return NextResponse.json({ error: "UPSERT_FAILED" }, { status: 400, headers: JSONH });

    // Archive existing confirmed
    const { error: archErr } = await db
      .from("bank_accounts")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("profile_id", user.id)
      .eq("status", "confirmed");
    if (archErr) return NextResponse.json({ error: archErr.message }, { status: 400, headers: JSONH });

    // Promote to confirmed
    const { error: confErr } = await db
      .from("bank_accounts")
      .update({ status: "confirmed", verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", targetId);
    if (confErr) return NextResponse.json({ error: confErr.message }, { status: 400, headers: JSONH });

    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
