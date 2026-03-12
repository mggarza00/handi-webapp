import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isValidEmailForRecovery } from "@/lib/auth/flow";
import { isBlockedDomain } from "@/lib/utils/validateEmailDomain";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const GENERIC_SUCCESS_MESSAGE =
  "Si existe una cuenta pendiente para este correo, te enviamos un nuevo enlace de confirmacion. Revisa bandeja de entrada, spam y promociones.";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = (body.email || "").trim().toLowerCase();

    if (!isValidEmailForRecovery(email)) {
      return NextResponse.json(
        { success: false, message: "Correo electronico no valido." },
        { status: 400, headers: JSONH },
      );
    }
    if (email.length < 6 || isBlockedDomain(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Usa un correo valido y evita dominios genericos.",
        },
        { status: 400, headers: JSONH },
      );
    }

    const ip = getClientIp(req);
    const limiterKey = `auth:resend-confirmation:${ip}:${email}`;
    const limit = checkRateLimit(limiterKey, 3, 5 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Has hecho demasiados intentos. Espera unos minutos para reenviar el correo.",
        },
        {
          status: 429,
          headers: {
            ...JSONH,
            "Retry-After": Math.ceil(limit.resetMs / 1000).toString(),
          },
        },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL;

    if (!supabaseUrl || !supabaseAnon || !appUrl) {
      console.error("Missing env vars for resend-confirmation", {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseAnon: !!supabaseAnon,
        hasAppUrl: !!appUrl,
      });
      return NextResponse.json(
        {
          success: false,
          message:
            "No pudimos completar la solicitud en este momento. Intenta de nuevo mas tarde.",
        },
        { status: 500, headers: JSONH },
      );
    }

    const client = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${appUrl.replace(/\/$/, "")}/auth/callback`,
      },
    });

    if (error) {
      const lowerMessage = (error.message || "").toLowerCase();
      const lowerCode = String(error.code || "").toLowerCase();
      const looksLikeRateLimit =
        lowerCode.includes("rate") ||
        lowerMessage.includes("rate") ||
        lowerMessage.includes("too many");
      if (looksLikeRateLimit) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Ya se envio recientemente un correo. Espera un momento e intentalo de nuevo.",
          },
          { status: 429, headers: JSONH },
        );
      }
      // Keep response generic to avoid user enumeration.
      console.error("Supabase resend confirmation error", {
        code: error.code,
        message: error.message,
      });
    }

    return NextResponse.json(
      { success: true, message: GENERIC_SUCCESS_MESSAGE },
      { headers: JSONH },
    );
  } catch (error) {
    console.error("Error in resend-confirmation API:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          "No pudimos reenviar el correo de confirmacion. Intenta de nuevo mas tarde.",
      },
      { status: 500, headers: JSONH },
    );
  }
}

export const dynamic = "force-dynamic";
