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
  amount_mxn: z.number().int().positive(),
});

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });

    const { request_id, professional_id, amount_mxn } = parsed.data;
    const admin = createServerClient();

    // Obtener datos de la solicitud y del cliente para armar el mensaje
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reqRow: { data: any; error: any } = await (admin as any)
      .from("requests")
      .select("id, title, created_by, city, category")
      .eq("id", request_id)
      .maybeSingle();
    if (reqRow.error || !reqRow.data) return NextResponse.json({ ok: false, error: "REQUEST_NOT_FOUND" }, { status: 404, headers: JSONH });
    // Keep for potential auditing needs; prefixed to satisfy no-unused-vars rule
    const _customer_id = reqRow.data.created_by as string;

    // Insertar notificación en user_notifications para el profesional
    // Tabla puede no estar tipada, usar any
    await (admin as any)
      .from("user_notifications")
      .insert({
        user_id: professional_id,
        type: "contract_request",
        title: "Solicitud de contratación",
        body: `${(reqRow.data as any).title || "Trabajo"} por $${amount_mxn} MXN`,
        link: `/mensajes`,
      });

    // Email (si hay MAIL_PROVIDER_KEY) al profesional (usando Admin API)
    try {
      const { data: proUser } = await admin.auth.admin.getUserById(professional_id);
      const email = proUser?.user?.email ?? null;
      if (email) {
        const html = `
          <p>Tienes una solicitud de contratación:</p>
          <ul>
            <li><strong>Trabajo:</strong> ${(reqRow.data as any).title || "Trabajo"}</li>
            <li><strong>Monto:</strong> $${amount_mxn} MXN</li>
            <li><strong>Ciudad:</strong> ${(reqRow.data as any).city ?? "—"}</li>
            <li><strong>Categoría:</strong> ${(reqRow.data as any).category ?? "—"}</li>
          </ul>
          <p>Responde desde tu bandeja: <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/mensajes">Mensajes</a></p>
        `;
        await sendEmail({ to: email, subject: "Solicitud de contratación", html }).catch(() => null);
      }
    } catch {
      // ignore email errors
    }

    // SMS (Twilio) si está configurado y hay teléfono en pro_applications
    try {
      const tel = await (admin as any)
        .from("pro_applications")
        .select("phone")
        .eq("user_id", professional_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const phone = tel?.data?.phone as string | null;
      if (phone) {
        const body = `Handi: Solicitud de contratación por $${amount_mxn} MXN para "${(reqRow.data as any).title || "Trabajo"}". Revisa tu bandeja en Handi.`;
        await sendSms({ to: phone, body }).catch(() => null);
      }
    } catch {
      // ignore sms errors
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    return NextResponse.json({ ok: false, error: msg }, { status, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
