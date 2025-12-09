import { NextResponse } from "next/server";
import { z } from "zod";
import resend, { RESEND_FROM, RESEND_REPLY_TO } from "@/lib/email/resend";

const Payload = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  _html: z.string().min(1),
});

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request) {
  try {
    // Body puede fallar al parsear → capturamos
    const raw = await req.json().catch(() => null);
    const parsed = Payload.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY", issues: parsed.error.flatten() },
        {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        },
      );
    }

    const { to, subject, _html } = parsed.data as { to: string; subject: string; _html: string };

    const hasHtml = typeof _html === 'string' && _html.trim().length > 0;
    const res = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      html: hasHtml ? _html : undefined,
      text: !hasHtml ? '' : undefined,
      reply_to: RESEND_REPLY_TO || undefined,
    } as any);

    if ((res as any)?.error) {
      const err = (res as any).error as { name?: string; message?: string } & Record<string, unknown>;
      const name = (err?.name || '').toString();
      const message = (err?.message || '').toString();
      const isSandbox = name === 'validation_error' || /you can only send testing emails/i.test(message);
      const serialized = sanitizeError(err);
      const body = isSandbox
        ? { ok: false, code: 'RESEND_SANDBOX_ERROR', hint: 'Tu dominio de envío debe estar verificado y el from debe usar ese dominio (p.ej. notificaciones@handi.mx).', error: serialized }
        : { ok: false, error: serialized };
      return NextResponse.json(body, { status: 400, headers: JSONH });
    }
    return NextResponse.json({ ok: true, id: (res as any)?.data?.id || null, to, subject }, { headers: JSONH });
  } catch (e: unknown) {
    const serialized = sanitizeCaught(e);
    return NextResponse.json({ ok: false, error: serialized }, { status: 400, headers: JSONH });
  }
}

function sanitizeError(err: any) {
  try {
    if (!err || typeof err !== 'object') return { message: String(err) };
    const { name, message, type, statusCode, code } = err as any;
    const out: Record<string, unknown> = {};
    if (name) out.name = name;
    if (message) out.message = message;
    if (type) out.type = type;
    if (statusCode) out.statusCode = statusCode;
    if (code) out.code = code;
    return out;
  } catch {
    return { message: 'UNKNOWN_ERROR' };
  }
}

function sanitizeCaught(e: unknown) {
  if (e && typeof e === 'object') {
    const any = e as any;
    return { name: any?.name || 'Error', message: any?.message || 'Unknown' };
  }
  return { message: String(e) };
}
