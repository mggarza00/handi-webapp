/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { notifyChatMessageByConversation } from "@/lib/chat-notifier";
import { sendEmail } from "@/lib/email";
import {
  renderServiceCompletedThankYouEmailHtml,
  renderServiceCompletedThankYouEmailText,
} from "@/lib/email-templates";
import { getUserOrThrow } from "@/lib/_supabase-server";
import { getAdminSupabase } from "@/lib/supabase/admin";

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

function getSupportEmail() {
  return (
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    "soporte@handi.mx"
  ).trim();
}

function formatServiceDateLabel(
  row: Record<string, unknown> | null,
): string | null {
  const scheduledDate =
    typeof row?.scheduled_date === "string" ? row.scheduled_date.trim() : null;
  const scheduledTime =
    typeof row?.scheduled_time === "string" ? row.scheduled_time.trim() : null;
  if (!scheduledDate) return null;

  const dateParts = scheduledDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateParts) return scheduledDate;

  const date = new Date(
    Number(dateParts[1]),
    Number(dateParts[2]) - 1,
    Number(dateParts[3]),
  );
  const dateLabel = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  if (!scheduledTime) return dateLabel;

  const timeParts = scheduledTime.match(/^(\d{2}):(\d{2})/);
  if (!timeParts) return `${dateLabel} | ${scheduledTime}`;

  const timeDate = new Date(
    2000,
    0,
    1,
    Number(timeParts[1]),
    Number(timeParts[2]),
  );
  const timeLabel = new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
  }).format(timeDate);

  return `${dateLabel} | ${timeLabel}`;
}

function getPhotoTimestamp(row: Record<string, unknown>): number {
  const raw =
    typeof row.uploaded_at === "string" && row.uploaded_at.trim()
      ? row.uploaded_at
      : typeof row.created_at === "string" && row.created_at.trim()
        ? row.created_at
        : "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractSortedPhotoUrls(rows: Record<string, unknown>[]): string[] {
  return rows
    .slice()
    .sort((a, b) => getPhotoTimestamp(b) - getPhotoTimestamp(a))
    .map((row) => {
      const directUrl = typeof row.url === "string" ? row.url.trim() : "";
      const imageUrl =
        typeof row.image_url === "string" ? row.image_url.trim() : "";
      return directUrl || imageUrl;
    })
    .filter(Boolean)
    .slice(0, 4);
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
        {
          ok: false,
          error: "VALIDATION_FAILED",
          detail: parsed.error.flatten(),
        },
        { status: 422, headers: JSONH },
      );
    }

    const { user } = await getUserOrThrow();
    const admin = getAdminSupabase() as any;

    const { data: reqRow } = await admin
      .from("requests")
      .select(
        "id, created_by, title, status, professional_id, accepted_professional_id, scheduled_date, scheduled_time",
      )
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

    await admin
      .from("requests")
      .update({ finalized_by_pro_at: new Date().toISOString() } as any)
      .eq("id", requestId)
      .is("finalized_by_pro_at", null);

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
      try {
        await notifyChatMessageByConversation({
          conversationId,
          senderId: user.id,
          text: "El profesional ha finalizado el trabajo.",
        });
      } catch {
        /* ignore notify failures */
      }
    }

    if (clientId) {
      try {
        const professionalIdForEmail = assignedProId || user.id;
        const [{ data: client }, { data: professional }, { data: servicePhotos }] =
          await Promise.all([
            admin
              .from("profiles")
              .select("full_name, email")
              .eq("id", clientId)
              .maybeSingle(),
            admin
              .from("profiles")
              .select("full_name")
              .eq("id", professionalIdForEmail)
              .maybeSingle(),
            admin
              .from("service_photos")
              .select("*")
              .eq("request_id", requestId)
              .eq("professional_id", professionalIdForEmail)
              .order("uploaded_at", { ascending: false, nullsFirst: false })
              .limit(8),
          ]);

        const email = (client as any)?.email as string | undefined;
        if (email) {
          const base = getBaseUrl();
          const confirmUrl = `${base}/mensajes/${conversationId}?confirm=1`;
          const helpUrl = `${base}/mensajes/${conversationId}?help=1`;
          const name = (client as any)?.full_name || "Cliente";
          const title = (reqRow as any)?.title || "tu solicitud";
          const professionalName =
            (professional as any)?.full_name || "Profesional Handi";
          const photoUrls = extractSortedPhotoUrls(
            Array.isArray(servicePhotos)
              ? (servicePhotos as Record<string, unknown>[])
              : [],
          );
          const serviceDateLabel = formatServiceDateLabel(
            reqRow as Record<string, unknown>,
          );
          const supportEmail = getSupportEmail();

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

          const thankYouSubject = "Gracias por confiar en Handi";
          const thankYouHtml = renderServiceCompletedThankYouEmailHtml({
            name,
            requestTitle: title,
            professionalName,
            serviceDateLabel,
            photoUrls,
            supportEmail,
          });
          const thankYouText = renderServiceCompletedThankYouEmailText({
            name,
            requestTitle: title,
            professionalName,
            serviceDateLabel,
            photoUrls,
            supportEmail,
          });
          await sendEmail({
            to: email,
            subject: thankYouSubject,
            html: thankYouHtml,
            text: thankYouText,
          }).catch(() => null);
        }
      } catch {
        /* ignore email failures */
      }
    }

    try {
      revalidatePath(`/mensajes/${conversationId}`);
      revalidatePath(`/requests/${requestId}`);
      revalidatePath(`/requests/explore/${requestId}`);
      revalidatePath("/requests/explore");
      revalidatePath("/requests");
      revalidatePath("/pro/calendar");
      revalidatePath("/pro");
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
