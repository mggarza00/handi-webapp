import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET() {
  try {
    const hasStripeKey = Boolean(process.env.STRIPE_SECRET_KEY);
    const feeStr = process.env.STRIPE_FEE_AMOUNT_MXN ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_FEE_MXN ?? "";
    const feeOk = Number.isFinite(Number(feeStr)) && Number(feeStr) > 0;

    let stripeImportOk = false;
    try { await import("stripe"); stripeImportOk = true; } catch { stripeImportOk = false; }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: supaErr } = await supabase.auth.getUser();

    return NextResponse.json(
      { ok: true, env: { hasStripeKey, feeConfigured: feeOk }, stripeImportOk, supabaseUser: Boolean(user), supabaseError: supaErr?.message ?? null },
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unexpected_error";
    return NextResponse.json({ ok: false, error: "unexpected_failure", detail: msg }, { status: 500, headers: JSON_HEADERS });
  }
}
