import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const InputSchema = z.object({
  services_desc: z.string().optional().default(""),
  taxonomy: z
    .array(
      z.object({
        category: z.string().optional().default(""),
        subcategory: z.string().optional().default(""),
      }),
    )
    .optional()
    .default([]),
});

type TaxonPair = { category: string; subcategory: string };

type LLMResponse = {
  categories?: unknown;
  subcategories?: unknown;
  confidence?: unknown;
};

function normalize(input: string) {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/[\s/.-]+/g, " ")
    .trim();
}

function dedupeKeepOrder<T>(items: T[]) {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { categories: [], subcategories: [], confidence: 0 },
        { headers: JSONH },
      );
    }

    const services_desc = (parsed.data.services_desc || "").trim();
    const rawTaxonomy = parsed.data.taxonomy || [];
    const taxonomy: TaxonPair[] = rawTaxonomy
      .map((row) => ({
        category: String(row.category || "").trim(),
        subcategory: String(row.subcategory || "").trim(),
      }))
      .filter((row) => row.category.length > 0);

    if (!services_desc || taxonomy.length === 0) {
      return NextResponse.json(
        { categories: [], subcategories: [], confidence: 0 },
        { headers: JSONH },
      );
    }

    const apiKey =
      process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_JSON || "";
    if (!apiKey) {
      return NextResponse.json(
        { categories: [], subcategories: [], confidence: 0 },
        { headers: JSONH },
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const url = "https://api.openai.com/v1/chat/completions";

    const systemPrompt = [
      "Eres un clasificador de servicios para Handi. Tu trabajo es seleccionar TODAS las categor\u00edas y subcategor\u00edas",
      "que el profesional puede atender, bas\u00e1ndote en su descripci\u00f3n.",
      "",
      "Reglas:",
      "- Responde SOLO con JSON v\u00e1lido (sin markdown, sin texto extra).",
      "- Multi-label: devuelve varias categor\u00edas/subcategor\u00edas si aplica (no solo una).",
      "- Usa EXCLUSIVAMENTE valores presentes en la TAXONOM\u00cdA proporcionada (coincidencia por nombre). No inventes nada.",
      "- Maximiza RECALL razonable: si la descripci\u00f3n es amplia o general (ej. mantenimiento general del hogar,",
      "  arreglos en casa, handyman, tod\u00f3logo), incluye todas las \u00e1reas plausibles de la taxonom\u00eda que normalmente",
      "  entran en mantenimiento (p. ej. plomer\u00eda, electricidad, pintura, pared/alba\u00f1iler\u00eda, carpinter\u00eda, etc.),",
      "  SIEMPRE que existan en la taxonom\u00eda.",
      "- Si el usuario menciona expl\u00edcitamente un servicio, incluye su(s) categor\u00eda(s)/subcategor\u00eda(s) directa(s)",
      "  y tambi\u00e9n las relacionadas necesarias para completar el trabajo si existen en la taxonom\u00eda.",
      "- No incluyas duplicados. Ordena primero lo m\u00e1s probable/relevante.",
      "- L\u00edmites: m\u00e1ximo 20 categor\u00edas y 50 subcategor\u00edas.",
      "- Si no hay suficientes se\u00f1ales, devuelve arreglos vac\u00edos.",
      "",
      "Formato de salida EXACTO:",
      "{",
      '  "categories": ["<category>", "..."],',
      '  "subcategories": [{ "category": "<category>", "subcategory": "<subcategory>" }],',
      '  "confidence": 0.0',
      "}",
      "confidence: 0..1 para el conjunto completo.",
    ].join("\n");

    const userPayload = {
      services_desc,
      taxonomy,
    };

    const bodyReq = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    } as const;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyReq),
    });

    if (!res.ok) {
      return NextResponse.json(
        { categories: [], subcategories: [], confidence: 0 },
        { headers: JSONH },
      );
    }

    const j = await res.json().catch(() => null);
    const content = j?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { categories: [], subcategories: [], confidence: 0 },
        { headers: JSONH },
      );
    }

    let parsedResp: LLMResponse | null = null;
    try {
      parsedResp = JSON.parse(content) as LLMResponse;
    } catch {
      return NextResponse.json(
        { categories: [], subcategories: [], confidence: 0 },
        { headers: JSONH },
      );
    }

    const allowedPairs = new Map<string, TaxonPair>();
    const allowedCategories = new Map<string, string>();
    taxonomy.forEach((row) => {
      const catKey = normalize(row.category);
      if (catKey) allowedCategories.set(catKey, row.category);
      const subKey = normalize(row.subcategory);
      const pairKey = `${catKey}|||${subKey}`;
      if (!allowedPairs.has(pairKey)) allowedPairs.set(pairKey, row);
    });

    const rawCategories = Array.isArray(parsedResp?.categories)
      ? (parsedResp?.categories as unknown[])
      : [];
    const rawSubcats = Array.isArray(parsedResp?.subcategories)
      ? (parsedResp?.subcategories as unknown[])
      : [];

    const categories: string[] = [];
    for (const entry of rawCategories) {
      const cat = String(entry ?? "").trim();
      if (!cat) continue;
      const key = normalize(cat);
      const allowed = allowedCategories.get(key);
      if (allowed) categories.push(allowed);
    }

    const subcategories: TaxonPair[] = [];
    for (const entry of rawSubcats) {
      if (!entry || typeof entry !== "object") continue;
      const cat = String((entry as any).category ?? "").trim();
      const sub = String((entry as any).subcategory ?? "").trim();
      if (!cat || !sub) continue;
      const pairKey = `${normalize(cat)}|||${normalize(sub)}`;
      const allowed = allowedPairs.get(pairKey);
      if (allowed) subcategories.push(allowed);
    }

    let finalCategories = dedupeKeepOrder(categories);
    const finalSubcats = dedupeKeepOrder(subcategories).slice(0, 50);
    for (const sub of finalSubcats) {
      if (!finalCategories.includes(sub.category))
        finalCategories.push(sub.category);
    }
    finalCategories = finalCategories.slice(0, 20);

    const confidence = Math.max(
      0,
      Math.min(1, Number(parsedResp?.confidence ?? 0) || 0),
    );

    return NextResponse.json(
      {
        categories: finalCategories,
        subcategories: finalSubcats,
        confidence,
      },
      { headers: JSONH },
    );
  } catch {
    return NextResponse.json(
      { categories: [], subcategories: [], confidence: 0 },
      { headers: JSONH },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
