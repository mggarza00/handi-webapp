// app/api/quotes/[id]/image/route.ts
import { NextResponse } from "next/server";
import React from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

import { getInterFont } from "@/lib/fonts";
import QuoteImage from "@/components/quote/QuoteImage";
import { createServerClient } from "@/lib/supabase";
import { getDevUserFromHeader, getUserFromRequestOrThrow } from "@/lib/auth-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PNG_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
} as const;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = (params?.id || "").trim();
    if (!id) return new Response("Missing id", { status: 400 });

    // Auth: permitir dev override; si no hay sesión, continuar (solo lectura server-side)
    let user = (await getDevUserFromHeader(req))?.user ?? null;
    if (!user) {
      try {
        ({ user } = await getUserFromRequestOrThrow(req));
      } catch {
        user = null as any;
      }
    }

    const admin = createServerClient();

    // Cargar quote + validar participación
    const { data: quote } = await admin
      .from("quotes")
      .select("id, conversation_id, professional_id, client_id, currency, items, total, created_at, folio")
      .eq("id", id)
      .maybeSingle();
    if (!quote) return new Response("Not found", { status: 404 });

    const { data: conv } = await admin
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", (quote as any).conversation_id)
      .maybeSingle();
    if (!conv) return new Response("Forbidden", { status: 403 });
    const uid = (user as any)?.id || null;
    if (uid) {
      if (uid !== (conv as any).customer_id && uid !== (conv as any).pro_id)
        return new Response("Forbidden", { status: 403 });
    }

    // Meta para render
    const [proProfile, clientProfile] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", (quote as any).professional_id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", (quote as any).client_id).maybeSingle(),
    ]);

    // Armar props para el componente visual
    const items = Array.isArray((quote as any).items)
      ? ((quote as any).items as Array<{ concept?: string; amount?: number }>).map((r) => ({
          description: String(r.concept ?? ""),
          amount: Number((r.amount as unknown) ?? 0) || 0,
        }))
      : [];

    const props = {
      logoUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ""}/images/Favicon-v1-jpeg.jpg`,
      title: "Cotización",
      folio: (quote as any)?.folio ? String((quote as any).folio) : String((quote as any).id).slice(0, 8),
      issuedAtISO: new Date((quote as any).created_at || Date.now()).toISOString(),
      professionalName: (proProfile?.data as any)?.full_name || "",
      clientName: (clientProfile?.data as any)?.full_name || "",
      serviceTitle: "Servicio solicitado",
      items,
      currency: (quote as any).currency || "MXN",
      notes: "Precio no incluye IVA ni comision. Sujeto a condiciones del servicio.",
      brandHex: "#0E7490",
      grayHex: "#E5E7EB",
    } as const;

    // Fuente Inter (ttf/woff2)
    let inter: ArrayBuffer | null = null;
    try { inter = await getInterFont(); } catch { inter = null; }

    // Render SVG con Satori
    const svg = await satori(React.createElement(QuoteImage, props), {
      width: 1080,
      height: 1600,
      fonts: inter ? [{ name: "Inter", data: inter, weight: 400, style: "normal" }] : [],
    });

    // Convertir a PNG
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
    const png = resvg.render().asPng();
    // Copy into a fresh Uint8Array to avoid SharedArrayBuffer typing
    const u8 = new Uint8Array(png.byteLength);
    u8.set(png);
    const blob = new Blob([u8], { type: "image/png" });
    return new Response(blob, { status: 200, headers: PNG_HEADERS });
  } catch (e: any) {
    const msg = e?.message || String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
