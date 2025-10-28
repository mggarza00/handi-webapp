/* eslint-disable @typescript-eslint/no-explicit-any */
import { Resend } from 'resend';

export const RESEND_FROM = (process.env.RESEND_FROM || '').trim();
export const RESEND_REPLY_TO = (process.env.RESEND_REPLY_TO || '').trim();

let singleton: Resend | null = null;

export function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Fail fast per producción: sin API key no hay envíos
    throw new Error('RESEND_API_KEY is not set');
  }
  if (!singleton) singleton = new Resend(key);
  return singleton;
}

export const resend = (() => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Crear un proxy que lanza solo al usarlo, evitando romper import en build locales sin key
    return new Proxy({} as unknown as Resend, {
      get() { throw new Error('RESEND_API_KEY is not set'); },
    });
  }
  return new Resend(key);
})();

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string | null;
  from?: string | null;
  replyTo?: string | string[] | null;
  // Base64 or Buffer content allowed by Resend client
  attachments?: Array<{ filename: string; content: string | Uint8Array }>;
};

/**
 * Envío centralizado con Resend. Devuelve ok=false si falta config.
 * Incluye hint cuando ocurren errores típicos de sandbox/domino.
 */
export async function resendSendEmail(payload: SendEmailInput): Promise<{ ok: boolean; id?: string; error?: string; hint?: string }>
{
  // Defaults desde env
  const envFrom = (process.env.RESEND_FROM || '').trim();
  const envReplyTo = (process.env.RESEND_REPLY_TO || '').trim();
  const from = (payload.from || envFrom || RESEND_FROM);
  const replyTo = (payload.replyTo || envReplyTo || undefined);

  if (!from) {
    return { ok: false, error: 'MISSING_FROM', hint: 'Define RESEND_FROM con un remitente del dominio verificado (p.ej. notificaciones@mg.handi.mx).' };
  }

  try {
    const client = getResendClient();
    const hasHtml = typeof payload.html === 'string' && payload.html.length > 0;
    const hasText = typeof payload.text === 'string' && payload.text.length > 0;
    const res = await client.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: hasHtml ? payload.html : undefined,
      text: hasText ? payload.text : (!hasHtml ? '' : undefined),
      reply_to: replyTo as any,
      attachments: payload.attachments as any,
    } as any);

    if ((res as any)?.error) {
      const err = (res as any).error as { name?: string; message?: string } & Record<string, unknown>;
      const msg = `${err?.name || 'SEND_ERROR'}: ${err?.message || 'unknown'}`;
      const hint = deriveResendHint(err?.message || '');
      return { ok: false, error: msg, hint, ...(err ? { details: sanitizeResendError(err) } : {}) } as any;
    }
    const id = (res as any)?.data?.id as string | undefined;
    return { ok: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    const hint = deriveResendHint(msg);
    const details = typeof e === 'object' && e
      ? sanitizeResendError(e as any)
      : { message: String(e) };
    return { ok: false, error: msg, hint, details } as any;
  }
}

function sanitizeResendError(err: any): Record<string, unknown> {
  try {
    if (!err || typeof err !== 'object') return { message: String(err) };
    const { name, message, type, statusCode, code, ...rest } = err as any;
    const base: Record<string, unknown> = {};
    if (name) base.name = name;
    if (message) base.message = message;
    if (type) base.type = type;
    if (statusCode) base.statusCode = statusCode;
    if (code) base.code = code;
    // Evita incluir stacks u objetos enormes
    return base;
  } catch {
    return { message: 'UNKNOWN_ERROR_OBJECT' };
  }
}

export default resend;

function deriveResendHint(message: string): string | undefined {
  const m = message.toLowerCase();
  if (m.includes('sandbox') || m.includes('trial') || m.includes('not allowed to send') || m.includes('from address') || m.includes('domain')) {
    return 'Verifica que RESEND_FROM pertenezca al dominio verificado (mg.handi.mx) y que DNS/SPF/DKIM estén activos. Asegura RESEND_API_KEY de producción.';
  }
  if (m.includes('unauthorized') || m.includes('401') || m.includes('invalid api key')) {
    return 'RESEND_API_KEY inválida o ausente. Define la key de producción en Vercel.';
  }
  return undefined;
}
