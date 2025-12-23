// lib/quotes/renderImage.ts
// Render vertical PNG (1080x1600) for quotes using Satori + Resvg
import fs from "node:fs";
import path from "node:path";

import React from "react";
import satori from "satori";
import type { Font } from "satori";
import { Resvg } from "@resvg/resvg-js";

import QuoteImage from "@/components/quote/QuoteImage";
import { getInterFont, getStackSansFont } from "@/lib/fonts";

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
  serviceTitle?: string | null;
  baseUrl?: string | null;
}): Promise<{ buffer: Buffer; contentType: "image/png" }> {
  let inter: ArrayBuffer | null = null;
  let stackSans: ArrayBuffer | null = null;
  try {
    inter = await getInterFont();
  } catch {
    inter = null; // fallback: let Satori use default sans-serif
  }
  try {
    stackSans = await getStackSansFont();
  } catch {
    stackSans = null;
  }
  const baseUrl =
    input.baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const logoUrl = `${baseUrl.replace(/\/$/, "")}/images/LOGO_HANDI_DB.png`;
  const watermarkUrl = `${baseUrl.replace(/\/$/, "")}/images/FAVICON_FOOTER.png`;
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
  const items = (input.items || []).map((i) => ({
    description: i.concept,
    amount: Number(i.amount || 0),
  }));
  const fonts: Font[] = [];
  if (inter) {
    fonts.push(
      { name: "Inter", data: inter, weight: 400, style: "normal" },
      { name: "Inter", data: inter, weight: 600, style: "normal" },
    );
  }
  if (stackSans) {
    fonts.push({
      name: "Stack Sans",
      data: stackSans,
      weight: 600,
      style: "normal",
    });
  }

  const svg = await satori(
    React.createElement(QuoteImage, {
      logoUrl,
      watermarkUrl,
      logoDataUrl,
      watermarkDataUrl,
      title: "Cotización",
      folio: input.folio,
      issuedAtISO: input.dateISO,
      professionalName: input.professional?.name || "",
      clientName: input.client?.name || "",
      serviceTitle: (input.serviceTitle && input.serviceTitle.trim().length
        ? input.serviceTitle
        : "Servicio solicitado") as string,
      items,
      currency: input.currency || "MXN",
      notes:
        input.notes && String(input.notes).trim().length > 0
          ? String(input.notes)
          : "Precios en MXN. Cotización válida por 7 días.",
      brandHex: "#0E7490",
      grayHex: "#E5E7EB",
    }),
    {
      width: 1080,
      height: 1600,
      fonts,
    },
  );
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
  const u8 = resvg.render().asPng();
  const buffer = Buffer.from(u8);
  return { buffer, contentType: "image/png" };
}
