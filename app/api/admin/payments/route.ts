import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  listAdminPayments,
  type AdminPaymentListItem,
} from "@/lib/admin/admin-payments";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fake(n: number): AdminPaymentListItem[] {
  const arr: AdminPaymentListItem[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: `pi_${Math.random().toString(36).slice(2, 10)}`,
      amount: Math.floor(200 + Math.random() * 5000),
      currency: "MXN",
      status: ["paid", "paid", "paid", "refunded", "failed"][
        i % 5
      ] as AdminPaymentListItem["status"],
      customer: `Cliente ${i + 1}`,
      created_at: new Date(Date.now() - i * 7200_000).toISOString(),
      payment_kind: i % 3 === 0 ? "onsite_quote" : "offer_payment",
      type_label:
        i % 3 === 0 ? "Cotización en sitio" : "Oferta de contratación",
      remuneration_label:
        i % 3 === 0 ? (i % 2 === 0 ? "Remunerable" : "No remunerable") : null,
      request_id: `req_${Math.floor(i / 2)}`,
      request_title: `Servicio ${Math.floor(i / 2) + 1}`,
      related_group_key: `req_${Math.floor(i / 2)}`,
      relation_label:
        i % 3 === 0
          ? "Relacionado con contratación"
          : "Relacionado con cotización onsite",
      onsite_credit_amount: i % 3 === 0 ? null : 200,
    });
  }
  return arr;
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey)
    return NextResponse.json({ ok: true, items: fake(15) }, { headers: JSONH });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = (url.searchParams.get("status") || "").toLowerCase();

  const admin = getAdminSupabase();
  try {
    const items = await listAdminPayments({
      admin,
      from,
      to,
      status,
      limit: 50,
    });
    return NextResponse.json({ ok: true, items }, { headers: JSONH });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: JSONH },
    );
  }
}
