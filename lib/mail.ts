type MailClientLike = {
  send?: (args: { to: string; subject: string; html?: string; text?: string; from?: string }) => Promise<unknown>;
};

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

/** Inyecta tu cliente real (Resend, SMTP, etc.) fuera de este módulo */
export function sendEmail(client: unknown, to: string, subject: string, body: { html?: string; text?: string }) {
  const c = client as MailClientLike;
  if (!c || typeof c !== "object" || typeof c.send !== "function") {
    throw new Error("Mail client inválido o sin método send()");
  }
  return c.send({ to, subject, html: body.html, text: body.text });
}
