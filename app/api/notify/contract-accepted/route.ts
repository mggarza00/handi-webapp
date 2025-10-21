/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  request_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  amount_mxn: z.number().int().positive(),
  checkout_url: z.string().url(),
  required_at: z.string().nullable().optional(),
});

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
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });

    const { request_id, professional_id, amount_mxn, checkout_url, required_at } = parsed.data;
    const admin = createServerClient();

    // Obtener informacion de la solicitud y validar cliente
    const reqRow: { data: any; error: any } = await (admin as any)
      .from("requests")
      .select("title, created_by, required_at")
      .eq("id", request_id)
      .maybeSingle();
    if (reqRow.error || !reqRow.data)
      return NextResponse.json({ ok: false, error: "REQUEST_NOT_FOUND" }, { status: 404, headers: JSONH });

    const reqData = reqRow.data as Record<string, any>;
    const customerId = typeof reqData.created_by === "string" ? (reqData.created_by as string) : null;
    if (!customerId)
      return NextResponse.json({ ok: false, error: "CUSTOMER_NOT_FOUND" }, { status: 404, headers: JSONH });

    const reqTitle: string = typeof reqData.title === "string" && reqData.title.trim() ? reqData.title : "Servicio";
    const serviceDate = formatServiceDate(required_at ?? (typeof reqData.required_at === "string" ? reqData.required_at : null));

    let proName: string | null = null;
    try {
      const proRow: { data: any } = await (admin as any)
        .from("profiles")
        .select("full_name")
        .eq("id", professional_id)
        .maybeSingle();
      proName = (proRow?.data?.full_name as string | undefined) || null;
    } catch {
      proName = null;
    }

    try {
      await (admin as any).from("user_notifications").insert({
        user_id: customerId,
        type: "contract_offer_accepted",
        title: "Oferta aceptada",
        body: serviceDate
          ? `${proName ?? "Tu profesional"} acepto la oferta por $${amount_mxn} MXN. Dia: ${serviceDate}.`
          : `${proName ?? "Tu profesional"} acepto la oferta por $${amount_mxn} MXN.`,
        link: checkout_url,
      });
    } catch {
      // ignore notification errors
    }

    try {
      const { data: customerUser } = await admin.auth.admin.getUserById(customerId);
      const email = customerUser?.user?.email ?? null;
      if (email) {
        const dateLine = serviceDate ? `<p><strong>Dia del servicio:</strong> ${serviceDate}</p>` : "";
        const html = `
          <p>${proName ?? "Tu profesional"} acepto la oferta de <strong>${reqTitle}</strong> por $${amount_mxn} MXN.</p>
          ${dateLine}
          <p>Paga el servicio para continuar:</p>
          <p><a href="${checkout_url}">Ir al pago</a></p>
        `;
        await sendEmail({ to: email, subject: "Oferta aceptada", html }).catch(() => null);
      }
    } catch {
      // ignore email errors
    }

    try {
      let phone: string | null = null;
      try {
        const customerProfile: { data: any } = await (admin as any)
          .from("customer_profiles")
          .select("phone")
          .eq("user_id", customerId)
          .maybeSingle();
        phone = (customerProfile?.data?.phone as string | undefined) || null;
      } catch {
        phone = null;
      }
      if (!phone) {
        try {
          const profileRow: { data: any } = await (admin as any)
            .from("profiles")
            .select("phone")
            .eq("id", customerId)
            .maybeSingle();
          phone = (profileRow?.data?.phone as string | undefined) || null;
        } catch {
          phone = null;
        }
      }
      if (phone) {
        const smsBody = serviceDate
          ? `Handi: ${proName ?? "Tu profesional"} acepto la oferta por $${amount_mxn} MXN (dia ${serviceDate}). Completa el pago: ${checkout_url}`
          : `Handi: ${proName ?? "Tu profesional"} acepto la oferta por $${amount_mxn} MXN. Completa el pago: ${checkout_url}`;
        await sendSms({ to: phone, body: smsBody }).catch(() => null);
      }
    } catch {
      // ignore sms errors
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const anyE = e as { status?: number } | null;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    return NextResponse.json({ ok: false, error: msg }, { status, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
