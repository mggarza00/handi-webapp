import { NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getUserOrThrow } from "@/lib/_supabase-server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  clientId: z.string().uuid().optional(),
  proId: z.string().uuid().optional(),
});

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (host ? `${proto}://${host}` : "http://localhost:3000")
  );
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const requestId = params.id;
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }

    const { user } = await getUserOrThrow();
    const admin = getAdminSupabase();

    const { data: reqRow } = await admin
      .from("requests")
      .select("id, created_by, title, status, professional_id, accepted_professional_id")
      .eq("id", requestId)
      .maybeSingle();
    if (!reqRow) {
      return NextResponse.json(
        { ok: false, error: "REQUEST_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    const clientId = parsed.data.clientId ?? (reqRow as any)?.created_by ?? null;
    const assignedProId =
      (reqRow as any)?.accepted_professional_id ??
      (reqRow as any)?.professional_id ??
      null;

    let isAssigned = assignedProId === user.id;
    if (!isAssigned) {
      const { data: agr } = await admin
        .from("agreements")
        .select("id")
        .eq("request_id", requestId)
        .eq("professional_id", user.id)
        .limit(1);
      isAssigned = Array.isArray(agr) && agr.length > 0;
    }
    if (!isAssigned) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }

    let conversationId: string | null = null;
    const { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("request_id", requestId)
      .eq("pro_id", user.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (conv?.id) {
      conversationId = conv.id as string;
    } else if (clientId) {
      const { data: convAlt } = await admin
        .from("conversations")
        .select("id")
        .eq("customer_id", clientId)
        .eq("pro_id", user.id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (convAlt?.id) conversationId = convAlt.id as string;
    }
    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: "CONVERSATION_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    const payload = {
      type: "service_finished",
      request_id: requestId,
      pro_id: user.id,
      customer_id: clientId,
    };

    const { data: existing } = await admin
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("message_type", "system")
      .contains("payload", { type: "service_finished", request_id: requestId })
      .limit(1);
    if (!Array.isArray(existing) || existing.length === 0) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: "El profesional ha finalizado el trabajo.",
        message_type: "system",
        payload,
      } as any);
      await admin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    if (clientId) {
      try {
        const { data: client } = await admin
          .from("profiles")
          .select("full_name, email")
          .eq("id", clientId)
          .maybeSingle();
        const email = (client as any)?.email as string | undefined;
        if (email) {
          const base = getBaseUrl();
          const confirmUrl = `${base}/mensajes/${conversationId}?confirm=1`;
          const helpUrl = `${base}/mensajes/${conversationId}?help=1`;
          const name = (client as any)?.full_name || "Cliente";
          const title = (reqRow as any)?.title || "tu solicitud";
          const subject = "Handi - El profesional ha finalizado el trabajo";
          const html = `
            <div style="font-family: Arial, sans-serif; color: #0f172a;">
              <p>Hola ${name},</p>
              <p>El profesional ha finalizado el trabajo de <strong>${title}</strong>.</p>
              <p>Confirma el servicio y califica tu experiencia.</p>
              <p style="margin: 24px 0;">
                <a href="${confirmUrl}" style="background:#0f172a;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;margin-right:12px;">Confirmar</a>
                <a href="${helpUrl}" style="background:#e2e8f0;color:#0f172a;padding:12px 18px;border-radius:8px;text-decoration:none;">Ayuda</a>
              </p>
              <p style="font-size:12px;color:#64748b;">Si necesitas apoyo adicional, responde a este correo.</p>
            </div>
          `;
          await sendEmail({ to: email, subject, html }).catch(() => null);
        }
      } catch {
        /* ignore email failures */
      }
    }

    try {
      revalidatePath(`/mensajes/${conversationId}`);
      revalidatePath(`/requests/${requestId}`);
    } catch {
      /* ignore */
    }

    return NextResponse.json(
      { ok: true, conversationId },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}
