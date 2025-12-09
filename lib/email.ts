// Email helper centralizado sobre Resend.
// No envía si falta configuración; regresa un hint útil.

import { resendSendEmail, type SendEmailInput } from "@/lib/email/resend";

type EmailAttachment = { filename: string; content: string | Uint8Array; mime?: string };

type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string | string[];
  text?: string;
  attachments?: EmailAttachment[];
};

function htmlToText(html: string): string {
  try {
    // Reemplaza enlaces por 'texto (url)'
    const withLinks = html.replace(
      /<a [^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi,
      (_m, href, text) => `${text} (${href})`,
    );
    // Quita el resto de etiquetas
    const noTags = withLinks.replace(/<[^>]+>/g, "");
    // Normaliza espacios
    return noTags
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return html;
  }
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id?: string; error?: string; hint?: string; details?: unknown }> {
  const { to, subject, html, from, text, replyTo, attachments } = payload;
  const plain = text && text.length > 0 ? text : htmlToText(html);
  const mappedAtt: SendEmailInput["attachments"] = attachments?.map((a) => ({
    filename: a.filename,
    content: a.content,
  }));
  const payloadToSend: SendEmailInput = {
    to,
    subject,
    html,
    text: plain,
    from: from ?? null,
    replyTo: replyTo ?? null,
    attachments: mappedAtt,
  };
  return resendSendEmail(payloadToSend);
}
