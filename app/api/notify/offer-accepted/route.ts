import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  offerId: z.string().uuid(),
  checkoutUrl: z.string().url().optional(),
});

type OfferRow = {
  id: string;
  client_id: string;
  professional_id: string;
  title: string;
  amount: number;
  currency: string;
  service_date: string | null;
  checkout_url: string | null;
};

function formatServiceDate(raw?: string | null): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${day}-${month}-${year}`;
}

export async function POST(req: Request) {
  try {
    const payload = BodySchema.safeParse(await req.json());
    if (!payload.success)
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: payload.error.flatten() },
        { status: 422, headers: JSONH },
      );

    const { offerId, checkoutUrl: bodyCheckoutUrl } = payload.data;
    const supabase = createServerClient();

    const { data: offerRow, error } = await supabase
      .from("offers")
      .select("id, client_id, professional_id, title, amount, currency, service_date, checkout_url")
      .eq("id", offerId)
      .single();

    if (error || !offerRow)
      return NextResponse.json({ ok: false, error: "OFFER_NOT_FOUND" }, { status: 404, headers: JSONH });

    const offer = offerRow as OfferRow;
    const checkoutUrl = bodyCheckoutUrl || offer.checkout_url;
    if (!checkoutUrl)
      return NextResponse.json({ ok: false, error: "MISSING_CHECKOUT_URL" }, { status: 400, headers: JSONH });

    const serviceDate = formatServiceDate(offer.service_date);

    const { data: customerUser } = await supabase.auth.admin.getUserById(offer.client_id);
    const email = customerUser?.user?.email || null;

    let phone: string | null = null;
    try {
      const profileRes = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", offer.client_id)
        .maybeSingle();
      if (!profileRes.error) {
        phone = (profileRes.data as { phone?: string | null } | null)?.phone ?? null;
      }
    } catch {
      phone = null;
    }

    const subject = "Oferta aceptada";
    const currency = offer.currency || "MXN";
    const formattedAmount = new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(offer.amount || 0));

    if (email) {
      const dateLine = serviceDate ? `<p><strong>Dia del servicio:</strong> ${serviceDate}</p>` : "";
      const html = `
        <p>Tu profesional acepto la oferta <strong>${offer.title}</strong> por ${formattedAmount}.</p>
        ${dateLine}
        <p>Completa el pago para continuar:</p>
        <p><a href="${checkoutUrl}">Ir al pago</a></p>
      `;
      await sendEmail({ to: email, subject, html }).catch(() => null);
    }

    if (phone) {
      const smsBody = serviceDate
        ? `Homaid: Tu profesional acepto la oferta por ${formattedAmount} (dia ${serviceDate}). Paga aqui: ${checkoutUrl}`
        : `Homaid: Tu profesional acepto la oferta por ${formattedAmount}. Paga aqui: ${checkoutUrl}`;
      await sendSms({ to: phone, body: smsBody }).catch(() => null);
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
