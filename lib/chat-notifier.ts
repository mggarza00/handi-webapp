/* eslint-disable @typescript-eslint/no-explicit-any */
import { sendEmail } from "@/lib/email";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { messageReceivedHtml } from "@/lib/email-templates";

type AttachmentLite = { filename?: string | null };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPreview(text?: string | null, attachments?: AttachmentLite[]): string {
  const t = (text || "").trim();
  if (t.length > 0) {
    const slice = t.slice(0, 240);
    return escapeHtml(slice + (t.length > 240 ? "…" : ""));
  }
  const files = (attachments || []).map((a) => (a?.filename || "archivo")).filter(Boolean);
  if (files.length === 0) return "Mensaje nuevo";
  const first = files[0] as string;
  if (files.length === 1) return `Archivo adjunto: ${escapeHtml(first)}`;
  if (files.length === 2) return `Archivos adjuntos: ${escapeHtml(first)} y 1 más`;
  return `Archivos adjuntos: ${escapeHtml(first)} y ${files.length - 1} más`;
}

/**
 * Envía un correo al otro participante cuando se crea un mensaje en un chat.
 * No lanza errores: si algo falla, simplemente hace no-op.
 */
export async function notifyChatMessageByConversation(opts: {
  conversationId: string;
  senderId: string;
  text?: string | null;
  attachments?: AttachmentLite[];
}) {
  try {
    const admin = getAdminSupabase();
    const { conversationId, senderId } = opts;

    // Obtener participantes y request
    const { data: conv } = await admin
      .from("conversations")
      .select("id, request_id, customer_id, pro_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return;

    const customerId = (conv as any)?.customer_id as string | undefined;
    const proId = (conv as any)?.pro_id as string | undefined;
    const requestId = (conv as any)?.request_id as string | undefined;

    const recipientId = senderId === customerId ? proId : customerId;
    if (!recipientId) return;

    // Email del destinatario
    const { data: userRes } = await admin.auth.admin.getUserById(recipientId);
    const to = (userRes?.user?.email || "").trim();
    if (!to) return;

    // Título de la request (si aplica)
    let requestTitle: string | undefined;
    if (requestId) {
      try {
        const { data: req } = await admin
          .from("requests")
          .select("title")
          .eq("id", requestId)
          .maybeSingle<{ title?: string | null }>();
        requestTitle = (req as any)?.title || undefined;
      } catch {
        // ignore
      }
    }

    // Link directo al chat
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";
    const linkUrl = `${base.replace(/\/$/, "")}/mensajes/${encodeURIComponent(conversationId)}`;

    const subject = requestTitle ? `Nuevo mensaje: ${requestTitle}` : "Nuevo mensaje en Handi";
    const preview = buildPreview(opts.text, opts.attachments);
    const html = messageReceivedHtml({ requestTitle, preview, linkUrl });

    await sendEmail({ to, subject, html }).catch(() => null);
  } catch {
    // no-op on failures
  }
}

