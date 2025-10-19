// lib/quotes/renderImage.ts
// Render vertical PNG (1080x1600) for quotes using Satori + Resvg
import React from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import QuoteImage from "@/components/quote/QuoteImage";
import { getInterFont } from "@/lib/fonts";

type Party = { name: string | null; email?: string | null };
type Item = { concept: string; amount: number };

export async function renderQuotePNG(input: {
  folio: string;
  dateISO: string;
  professional: Party;
  client: Party;
  currency: string;
  items: Item[];
  total: number;
  notes?: string | null;
}): Promise<{ buffer: Buffer; contentType: "image/png" }> {
  let inter: ArrayBuffer | null = null;
  try {
    inter = await getInterFont();
  } catch {
    inter = null; // fallback: let Satori use default sans-serif
  }
  const items = (input.items || []).map((i) => ({ description: i.concept, amount: Number(i.amount || 0) }));
  const svg = await satori(
    React.createElement(QuoteImage, {
      logoUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ""}/images/Favicon-v1-jpeg.jpg`,
      title: "Cotización",
      folio: input.folio,
      issuedAtISO: input.dateISO,
      professionalName: input.professional?.name || "",
      clientName: input.client?.name || "",
      serviceTitle: "Servicio solicitado",
      items,
      currency: input.currency || "MXN",
      notes: (input.notes && String(input.notes).trim().length > 0)
        ? String(input.notes)
        : "Precios en MXN. Cotización válida por 7 días.",
      brandHex: "#0E7490",
      grayHex: "#E5E7EB",
    }),
    {
      width: 1080,
      height: 1600,
      fonts: inter ? [{ name: "Inter", data: inter, weight: 400, style: "normal" }] : [],
    },
  );
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
  const u8 = resvg.render().asPng();
  const buffer = Buffer.from(u8);
  return { buffer, contentType: "image/png" };
}
