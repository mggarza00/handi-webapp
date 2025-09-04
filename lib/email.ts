// Email helper: server-side only. Uses MAIL_PROVIDER_KEY for Resend-compatible API.
// If no key is configured, functions resolve without sending (no-op).

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  text?: string;
};

function getMailKey(): string | null {
  return process.env.MAIL_PROVIDER_KEY || null;
}

function getDefaultFrom(): string {
  const from = process.env.MAIL_FROM || process.env.NEXT_PUBLIC_SITE_NAME || "Handee";
  const email = process.env.MAIL_FROM_ADDRESS || "no-reply@handee.local";
  return /</.test(from) ? from : `${from} <${email}>`;
}

function htmlToText(html: string): string {
  try {
    // Reemplaza enlaces por 'texto (url)'
    const withLinks = html.replace(/<a [^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (_m, href, text) => `${text} (${href})`);
    // Quita el resto de etiquetas
    const noTags = withLinks.replace(/<[^>]+>/g, "");
    // Normaliza espacios
    return noTags.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return html;
  }
}

export async function sendEmail({ to, subject, html, from, text }: EmailPayload): Promise<{ ok: boolean; id?: string }> {
  const key = getMailKey();
  if (!key) return { ok: true };

  const sender = from || getDefaultFrom();
  const plain = text && text.length > 0 ? text : htmlToText(html);

  // Resend-like REST API
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ from: sender, to, subject, html, text: plain }),
  }).catch(() => null);

  if (!res) return { ok: false };
  if (!res.ok) return { ok: false };
  try {
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data?.id };
  } catch {
    return { ok: true };
  }
}
