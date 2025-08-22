import { NextResponse } from "next/server";
import { z } from "zod";

const Payload = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  _html: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    // Body puede fallar al parsear → capturamos
    const raw = await req.json().catch(() => null);
    const parsed = Payload.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { to, subject, _html } = parsed.data;

    const apiKey = process.env.MAIL_PROVIDER_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "MISSING_MAIL_PROVIDER_KEY" },
        { status: 500 },
      );
    }

    // Aquí iría el envío real (Resend/SMTP). V1: respondemos éxito simulado.
    // Importante: no exponer la KEY en respuesta.
    return NextResponse.json({ ok: true, sent: { to, subject } });
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    const status = err?.name === "ZodError" ? 400 : 500;
    return NextResponse.json(
      { ok: false, error: err?.message ?? "INTERNAL_ERROR" },
      { status },
    );
  }
}
