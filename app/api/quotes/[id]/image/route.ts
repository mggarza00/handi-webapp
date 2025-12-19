// app/api/quotes/[id]/image/route.ts
import { NextResponse } from "next/server";
import React from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

import { getInterFont, getStackSansFont } from "@/lib/fonts";
import QuoteImage from "@/components/quote/QuoteImage";
import { createServerClient } from "@/lib/supabase";
import {
  getDevUserFromHeader,
  getUserFromRequestOrThrow,
} from "@/lib/auth-route";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PNG_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control":
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
} as const;

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
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
    let { data: quote } = await admin
      .from("quotes")
      .select(
        "id, conversation_id, professional_id, client_id, currency, items, total, created_at, folio, image_path",
      )
      .eq("id", id)
      .maybeSingle();
    if (!quote) {
      // Fallback: intentar por folio (case-insensitive) o por prefijo de id (8-12 chars)
      const isLikelyShortId = id.length >= 6 && id.length <= 12;
      const { data: alt } = await admin
        .from("quotes")
        .select(
          "id, conversation_id, professional_id, client_id, currency, items, total, created_at, folio, image_path",
        )
        .or(`lower(folio).eq.${id.toLowerCase()},id.like.${id}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (
        alt &&
        (isLikelyShortId ||
          (alt as any).folio?.toString().toLowerCase() === id.toLowerCase())
      ) {
        quote = alt;
      } else {
        return new Response("Not found", { status: 404 });
      }
    }

    const { data: conv } = await admin
      .from("conversations")
      .select("id, customer_id, pro_id, request_id")
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
      admin
        .from("profiles")
        .select("full_name")
        .eq("id", (quote as any).professional_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("full_name")
        .eq("id", (quote as any).client_id)
        .maybeSingle(),
    ]);

    // Si ya hay una imagen en Storage, redirige a la URL firmada
    const imagePath = (quote as any).image_path as string | null;
    if (imagePath && typeof imagePath === "string" && imagePath.trim().length) {
      try {
        const { getSignedUrl } = await import("@/lib/storage/quotes");
        const signed = await getSignedUrl(imagePath, 600);
        if (signed) return NextResponse.redirect(signed, 302);
      } catch {
        // Si falla, continúa a render dinámico
      }
    }

    // Armar props para el componente visual
    const items = Array.isArray((quote as any).items)
      ? (
          (quote as any).items as Array<{ concept?: string; amount?: number }>
        ).map((r) => ({
          description: String(r.concept ?? ""),
          amount: Number((r.amount as unknown) ?? 0) || 0,
        }))
      : [];

    // Resolve service title + details/conditions
    let serviceTitle: string | null = null;
    let detailsText: string | null = null;
    try {
      // 1) Prefer 'notes' sent by pro in the original quote message payload
      const { data: msg } = await admin
        .from("messages")
        .select("payload")
        .eq("conversation_id", (quote as any).conversation_id)
        .eq("message_type", "quote")
        .filter("payload->>quote_id", "eq", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const payload = (msg as any)?.payload as Record<string, unknown> | null;
      const notes =
        payload && typeof (payload as any).notes === "string"
          ? String((payload as any).notes)
          : null;

      // 2) Request meta (title + conditions)
      let reqConditions: string | null = null;
      const reqId = (conv as any)?.request_id as string | null;
      if (reqId) {
        const { data: req } = await admin
          .from("requests")
          .select("title, conditions")
          .eq("id", reqId)
          .maybeSingle();
        const cond = (req as any)?.conditions as string | null;
        const title = (req as any)?.title as string | null;
        if (cond && cond.trim().length) reqConditions = cond.trim();
        if (title && title.trim().length) serviceTitle = title.trim();
      }

      const parts: string[] = [];
      if (notes && notes.trim().length) parts.push(notes.trim());
      if (reqConditions && reqConditions.trim().length)
        parts.push(`Condiciones: ${reqConditions}`);
      detailsText = parts.length ? parts.join("\n\n") : null;
    } catch {
      detailsText = detailsText || null;
    }

    const origin = new URL(req.url).origin;
    const assetBase =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      origin;
    const base = assetBase.replace(/\/$/, "");
    const logoPath = path.join(
      process.cwd(),
      "public",
      "images",
      "LOGO_HANDI_DB.png",
    );
    const watermarkPath = path.join(
      process.cwd(),
      "public",
      "images",
      "FAVICON_FOOTER.png",
    );
    const logoDataUrl = (() => {
      try {
        const buf = fs.readFileSync(logoPath);
        return `data:image/png;base64,${buf.toString("base64")}`;
      } catch {
        return null;
      }
    })();
    const watermarkDataUrl = (() => {
      try {
        const buf = fs.readFileSync(watermarkPath);
        return `data:image/png;base64,${buf.toString("base64")}`;
      } catch {
        return null;
      }
    })();

    const props = {
      logoUrl: `${base}/images/LOGO_HANDI_DB.png`,
      watermarkUrl: `${base}/images/FAVICON_FOOTER.png`,
      logoDataUrl,
      watermarkDataUrl,
      title: "Cotización",
      folio: (quote as any)?.folio
        ? String((quote as any).folio)
        : String((quote as any).id).slice(0, 8),
      issuedAtISO: new Date(
        (quote as any).created_at || Date.now(),
      ).toISOString(),
      professionalName: (proProfile?.data as any)?.full_name || "",
      clientName: (clientProfile?.data as any)?.full_name || "",
      serviceTitle: serviceTitle || "Servicio solicitado",
      items,
      currency: (quote as any).currency || "MXN",
      notes:
        detailsText ||
        "Precio no incluye IVA ni comision. Sujeto a condiciones del servicio.",
      brandHex: "#0E7490",
      grayHex: "#E5E7EB",
    } as const;

    // Fuente Inter (ttf/woff2)
    let inter: ArrayBuffer | null = null;
    let stackSans: ArrayBuffer | null = null;
    try {
      inter = await getInterFont();
    } catch {
      inter = null;
    }
    try {
      stackSans = await getStackSansFont();
    } catch {
      stackSans = null;
    }

    let svg: string | null = null;
    try {
      // Render SVG con Satori (siempre generamos SVG primero)
      svg = await satori(React.createElement(QuoteImage, props), {
        width: 1080,
        height: 1600,
        fonts: [
          ...(inter
            ? [
                { name: "Inter", data: inter, weight: 400, style: "normal" },
                { name: "Inter", data: inter, weight: 600, style: "normal" },
              ]
            : []),
          ...(stackSans
            ? [
                {
                  name: "Stack Sans",
                  data: stackSans,
                  weight: 600,
                  style: "normal",
                },
              ]
            : []),
        ],
      });
    } catch (err) {
      console.error("[quote-image] satori render error", err);
      // Fallback SVG minimal en caso de error (evita 500)
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1600"><rect width="100%" height="100%" fill="#fff"/><text x="50%" y="50%" text-anchor="middle" font-family="Inter, Arial" font-size="32" fill="#0F172A">Cotización ${props.folio}</text></svg>`;
    }

    // Intentar convertir a PNG con Resvg; si falla, devolver SVG
    try {
      const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
      const png = resvg.render().asPng();
      const u8 = new Uint8Array(png);
      return new Response(u8, { status: 200, headers: PNG_HEADERS });
    } catch {
      return new Response(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": PNG_HEADERS["Cache-Control"],
        },
      });
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}
