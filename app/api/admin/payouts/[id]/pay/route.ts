import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { notifyAdminsEmail, notifyAdminsInApp } from "@/lib/admin/admin-notify";
import { sendEmail } from "@/lib/email";
import { getStripeForMode } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const admin = getAdminSupabase();
  const payoutId = params.id;
  const { data: payout } = await admin
    .from("payouts")
    .select(
      "id, request_id, agreement_id, professional_id, amount, currency, status, receipt_url, metadata",
    )
    .eq("id", payoutId)
    .maybeSingle();

  if (!payout) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404, headers: JSONH },
    );
  }
  if (payout.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "INVALID_STATUS" },
      { status: 409, headers: JSONH },
    );
  }
  const amount = Number(payout.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, error: "INVALID_AMOUNT" },
      { status: 400, headers: JSONH },
    );
  }

  const { data: pro } = await admin
    .from("professionals")
    .select("stripe_account_id")
    .eq("id", payout.professional_id)
    .maybeSingle();
  const stripeAccountId = (pro as { stripe_account_id?: string | null } | null)
    ?.stripe_account_id;
  if (!stripeAccountId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_STRIPE_ACCOUNT" },
      { status: 409, headers: JSONH },
    );
  }

  const stripe =
    (await getStripeForMode("live")) || (await getStripeForMode("test"));
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "STRIPE_NOT_CONFIGURED" },
      { status: 500, headers: JSONH },
    );
  }

  let transferId: string | null = null;
  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: String(payout.currency || "MXN").toLowerCase(),
      destination: stripeAccountId,
      metadata: {
        payout_id: payout.id,
        request_id: payout.request_id || "",
        agreement_id: payout.agreement_id || "",
      },
    });
    transferId = transfer.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "TRANSFER_FAILED";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: JSONH },
    );
  }

  const nowIso = new Date().toISOString();
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const receiptUrl = `${base}/api/admin/payouts/${encodeURIComponent(payout.id)}/receipt`;

  await admin
    .from("payouts")
    .update({
      status: "paid",
      stripe_transfer_id: transferId,
      paid_at: nowIso,
      receipt_url: receiptUrl,
      metadata: {
        ...(payout as any).metadata,
        stripe_account_id: stripeAccountId,
      },
    })
    .eq("id", payout.id);

  // Email to professional
  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", payout.professional_id)
      .maybeSingle();
    const proEmail = (prof as any)?.email as string | null;
    const proName = (prof as any)?.full_name as string | null;
    if (proEmail) {
      const html = `
        <p>Hola ${proName || "Profesional"},</p>
        <p>Tu pago fue realizado.</p>
        <ul>
          <li>Monto: <strong>$${amount.toFixed(2)} ${payout.currency || "MXN"}</strong></li>
          <li>Payout ID: ${payout.id}</li>
        </ul>
        <p><a href="${receiptUrl}">Descargar comprobante</a></p>
      `;
      await sendEmail({
        to: proEmail,
        subject: "Handi - Pago realizado",
        html,
      });
    }
  } catch {
    /* ignore */
  }

  // Notify admins
  try {
    await notifyAdminsInApp(admin, {
      type: "payout:paid",
      title: "Payout realizado",
      body: `Payout pagado por $${amount.toFixed(2)} ${payout.currency || "MXN"}`,
      link: "/admin/payouts",
    });
    const html = `
      <p>Se realizo un payout.</p>
      <ul>
        <li>Monto: <strong>$${amount.toFixed(2)} ${payout.currency || "MXN"}</strong></li>
        <li>Payout ID: ${payout.id}</li>
        <li>Transfer ID: ${transferId}</li>
      </ul>
      <p><a href="${base}/admin/payouts">Abrir payouts</a></p>
    `;
    await notifyAdminsEmail({
      subject: "HANDI - Payout realizado",
      html,
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json(
    {
      ok: true,
      data: { id: payout.id, status: "paid", receipt_url: receiptUrl },
    },
    { headers: JSONH },
  );
}
