import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  listAdminPayments,
  type AdminPaymentListItem,
} from "@/lib/admin/admin-payments";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toCSV(rows: AdminPaymentListItem[]): string {
  const escape = (v: unknown) => {
    const s = (v ?? "").toString();
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "id",
    "type",
    "remuneration",
    "amount",
    "currency",
    "status",
    "customer",
    "request_title",
    "relation",
    "created_at",
  ].join(",");
  const lines = rows.map((row) =>
    [
      row.id,
      row.type_label,
      row.remuneration_label || "",
      row.amount,
      row.currency,
      row.status,
      row.customer,
      row.request_title || "",
      row.relation_label || "",
      row.created_at,
    ]
      .map(escape)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!svcKey) {
    const now = new Date();
    const mock: AdminPaymentListItem[] = Array.from({ length: 15 }).map(
      (_, i) => ({
        id: `pi_${Math.random().toString(36).slice(2, 10)}`,
        amount: Math.floor(200 + Math.random() * 5000),
        currency: "MXN",
        status: "paid",
        customer: `Cliente ${i + 1}`,
        created_at: new Date(now.getTime() - i * 7200_000).toISOString(),
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
      }),
    );
    const csv = toCSV(mock);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=payments.csv",
        "Cache-Control": "no-store",
      },
    });
  }

  const admin = getAdminSupabase();
  try {
    const rows = await listAdminPayments({
      admin,
      from,
      to,
      limit: 2000,
    });
    const csv = toCSV(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=payments.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: JSONH },
    );
  }
}
