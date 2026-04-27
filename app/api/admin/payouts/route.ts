import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  listAdminPayouts,
  type AdminPayoutListItem,
} from "@/lib/admin/admin-payouts";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fake(n: number): AdminPayoutListItem[] {
  const arr: AdminPayoutListItem[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: `po_${Math.random().toString(36).slice(2, 10)}`,
      professional_id: `pro_${i + 1}`,
      professional_name: `Profesional ${i + 1}`,
      amount: Math.floor(500 + Math.random() * 5000),
      currency: "MXN",
      status: i % 4 === 0 ? "paid" : "pending",
      created_at: new Date(Date.now() - i * 3600_000).toISOString(),
      paid_at:
        i % 4 === 0 ? new Date(Date.now() - i * 1800_000).toISOString() : null,
      receipt_url: i % 4 === 0 ? `/api/admin/payouts/po_${i}/receipt` : null,
      payout_kind: i % 3 === 0 ? "onsite_quote" : "service_offer",
      type_label:
        i % 3 === 0 ? "Cotización en sitio" : "Oferta de contratación",
      remuneration_label:
        i % 3 === 0 ? (i % 2 === 0 ? "Remunerable" : "No remunerable") : null,
      request_id: `req_${Math.floor(i / 2)}`,
      request_title: `Servicio ${Math.floor(i / 2) + 1}`,
      related_group_key: `req_${Math.floor(i / 2)}`,
      relation_label:
        i % 3 === 0
          ? "Relacionado con payout final"
          : "Relacionado con cotización onsite",
      gross_amount: i % 3 === 0 ? 200 : 1200,
      commission_amount: i % 3 === 0 ? 10 : 60,
    });
  }
  return arr;
}

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey)
    return NextResponse.json({ ok: true, items: fake(20) }, { headers: JSONH });

  const admin = getAdminSupabase();
  try {
    const items = await listAdminPayouts(admin);
    return NextResponse.json({ ok: true, items }, { headers: JSONH });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: JSONH },
    );
  }
}
