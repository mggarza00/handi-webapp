import { NextResponse } from "next/server";

import { renderResetPasswordEmailHtml } from "@/lib/emails/resetPasswordEmail";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isBlockedDomain } from "@/lib/utils/validateEmailDomain";
import { Resend } from "resend";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  console.log("RESET API HIT");
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = (body.email || "").trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Correo electrónico no válido." },
        { status: 400, headers: JSONH },
      );
    }
    if (email.length < 6 || isBlockedDomain(email)) {
      return NextResponse.json(
        { success: false, message: "Usa un correo válido y evita dominios genéricos." },
        { status: 400, headers: JSONH },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.PASSWORD_RESET_FROM_EMAIL;
    const appUrl =
      process.env.PASSWORD_RESET_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_APP_URL;

    if (!resendApiKey || !fromEmail || !appUrl) {
      console.error("Missing env vars for password reset", {
        hasResendApiKey: !!resendApiKey,
        hasFromEmail: !!fromEmail,
        hasAppUrl: !!appUrl,
      });
      return NextResponse.json(
        { success: false, message: "Configuración de correo incompleta en el servidor." },
        { status: 500, headers: JSONH },
      );
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${appUrl.replace(/\/$/, "")}/auth/reset-password`,
      },
    });
    if (error || !data?.properties?.action_link) {
      console.error("Supabase generateLink error:", error);
      return NextResponse.json(
        {
          success: false,
          message: error?.message || "No se pudo generar el enlace de recuperación.",
        },
        { status: 500, headers: JSONH },
      );
    }

    const resetUrl = data.properties.action_link;

    const resend = new Resend(resendApiKey);
    const { data: emailData, error: resendError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Handi · Restablecer tu contraseña",
      html: renderResetPasswordEmailHtml({ resetUrl, email }),
    });
    if (resendError) {
      console.error("Resend error sending reset email:", resendError);
      return NextResponse.json(
        {
          success: false,
          message: "No pudimos enviar el correo de recuperación. Inténtalo de nuevo más tarde.",
        },
        { status: 500, headers: JSONH },
      );
    }
    if (!emailData?.id) {
      console.error("Resend no devolvió ID de correo", emailData);
      return NextResponse.json(
        {
          success: false,
          message: "No pudimos enviar el correo de recuperación. Inténtalo de nuevo más tarde.",
        },
        { status: 500, headers: JSONH },
      );
    }

    return NextResponse.json({ success: true }, { headers: JSONH });
  } catch (error) {
    console.error("Error in send-password-reset API:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Error al enviar el correo de recuperación.";
    return NextResponse.json({ success: false, message }, { status: 500, headers: JSONH });
  }
}

export const dynamic = "force-dynamic";
