import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

// Simple in-memory rate limiter per IP (best-effort, per-instance)
const RATE_WINDOW_MS = 60_000; // 1 min
const RATE_LIMIT_PER_MIN = Number(process.env.CLASSIFY_RATE_PER_MIN || "30");
const RATE_BUCKET = new Map<string, number[]>();

const InputSchema = z
  .object({
    title: z.string().optional().default(""),
    description: z.string().optional().default(""),
  })
  .refine((v) => (v.title?.trim() || v.description?.trim())?.length, {
    message: "title or description required",
    path: ["title"],
  });

type TaxonRow = {
  id: string; // categories_subcategories_id
  category: string; // e.g., "Plomería"
  subcategory: string; // may be empty string
  active: boolean;
  description?: string | null;
  serviceType?: string | null;
};

type Suggestion = {
  category_id: string | null;
  subcategory_id: string | null;
  category: string;
  subcategory: string; // may be empty string
  confidence: number; // 0..1
  source?: "keyword" | "heuristic" | "gpt";
  model?: string | null;
};

type RawSuggestion = {
  category_id?: string | null;
  subcategory_id?: string | null;
  category?: string | null;
  subcategory?: string | null;
  confidence?: number | null;
};

type LLMResponse = {
  best?: RawSuggestion | null;
  alternatives?: RawSuggestion[] | null;
};

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñáéíóúü\s/.-]/gi, " ")
    .replace(/[\s/.-]+/g, " ")
    .trim();
}

function stem(s: string): string {
  let t = s;
  t = t.replace(/aciones$/i, "acion");
  t = t.replace(/ciones$/i, "cion");
  if (t.length >= 5 && /[a-z]es$/i.test(t)) t = t.slice(0, -2);
  else if (t.length >= 4 && /[a-z]s$/i.test(t)) t = t.slice(0, -1);
  return t;
}

const STOPWORDS = new Set(
  [
    "de",
    "la",
    "el",
    "los",
    "las",
    "y",
    "o",
    "para",
    "con",
    "por",
    "un",
    "una",
    "en",
    "del",
    "al",
    "mi",
    "su",
    "que",
    "es",
    "se",
    "me",
    "tengo",
    "necesito",
    "busco",
    "quiero",
    "debo",
    "hacer",
    "servicio",
    "arreglo",
    "arreglar",
    "reparacion",
    "reparar",
    "instalacion",
    "instalar",
    "ayuda",
  ].map((w) => norm(w)),
);

function tokenize(s: string): string[] {
  const toks = norm(s)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map((t) => stem(t))
    .filter(Boolean);
  return Array.from(new Set(toks));
}

function ipFrom(req: Request): string {
  try {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const xrip = req.headers.get("x-real-ip");
    if (xrip) return xrip.trim();
  } catch {
    // ignore header parsing issues
  }
  return "anon";
}

function allowRate(ip: string): boolean {
  const now = Date.now();
  const arr = RATE_BUCKET.get(ip) ?? [];
  const recent = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_PER_MIN) {
    RATE_BUCKET.set(ip, recent);
    return false;
  }
  recent.push(now);
  RATE_BUCKET.set(ip, recent);
  return true;
}

async function loadTaxonomy(): Promise<TaxonRow[]> {
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("categories_subcategories")
      .select('"categories_subcategories_id","Categoría","Subcategoría","Activa","Descripción","Tipo de servicio"');
    if (error) throw error;
    const isActive = (v: unknown) => {
      const s = String(v ?? "").trim().toLowerCase();
      return (
        s === "sí" || s === "si" || s === "true" || s === "1" || s === "activo" || s === "activa" || s === "x"
      );
    };
    const rows = (Array.isArray(data) ? data : []).map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        id: String(rec["categories_subcategories_id"] ?? "").trim(),
        category: String(rec["Categoría"] ?? "").trim(),
        subcategory: String(rec["Subcategoría"] ?? "").trim(),
        active: isActive(rec["Activa"]),
        description: (rec["Descripción"] as string | null) ?? null,
        serviceType: (rec["Tipo de servicio"] as string | null) ?? null,
      } as TaxonRow;
    });
    return rows.filter((r) => r.active && r.category);
  } catch {
    // Fallback tiny taxonomy with deterministic IDs (dev/test only)
    const tiny: Array<{ category: string; subcategory: string; description?: string }> = [
      { category: "Plomería", subcategory: "Fugas y reparaciones", description: "fuga, tubería, mezcladora, wc, regadera" },
      { category: "Plomería", subcategory: "Instalación de accesorios", description: "lavabo, fregadero, accesorios" },
      { category: "Electricidad", subcategory: "Instalación de luminarias", description: "lámpara, foco, plafón, iluminación" },
      { category: "Electricidad", subcategory: "Contactos y apagadores", description: "contacto, apagador, corto" },
      { category: "Herrería", subcategory: "Portones y protecciones", description: "portón, barandal, protección, soldar" },
      { category: "Aire acondicionado", subcategory: "Mantenimiento y recarga", description: "clima, minisplit, gas, mantenimiento" },
      { category: "Jardinería", subcategory: "Poda y mantenimiento", description: "poda, jardín, pasto, riego" },
    ];
    return tiny.map((t) => ({
      id: crypto.createHash("sha1").update(`${t.category}::${t.subcategory}`).digest("hex").slice(0, 32),
      category: t.category,
      subcategory: t.subcategory,
      active: true,
      description: t.description ?? null,
      serviceType: null,
    }));
  }
}

function scoreByHeuristics(rows: TaxonRow[], title: string, description: string): Suggestion[] {
  const titleTokens = tokenize(title);
  const descTokens = tokenize(description ?? "");
  const tTokens = new Set(titleTokens);
  const dTokens = new Set(descTokens);
  const tokenSet = new Set([...tTokens, ...dTokens]);

  // base score from description + serviceType + subcategory tokens
  const withKeywords = rows.map((r) => {
    const kwSub = new Set(tokenize(r.subcategory));
    const kwDesc = new Set(tokenize(r.description ?? ""));
    const kwType = new Set(tokenize(r.serviceType ?? ""));
    let score = 0;
    for (const k of kwSub) { if (tTokens.has(k)) score += 3.0; if (dTokens.has(k)) score += 2.0; }
    for (const k of kwType) { if (tTokens.has(k)) score += 2.0; if (dTokens.has(k)) score += 1.0; }
    for (const k of kwDesc) { if (tTokens.has(k)) score += 1.2; if (dTokens.has(k)) score += 0.8; }
    const subNorm = norm(r.subcategory);
    if (subNorm && (norm(title).includes(subNorm) || norm(description).includes(subNorm))) score += 2.5;
    return { r, score };
  });
  const maxScore = withKeywords.reduce((m, s) => Math.max(m, s.score), 0);
  const keywordSugs: Suggestion[] = maxScore > 0
    ? withKeywords.filter((s) => s.score > 0).map((s) => ({
        category_id: null, // filled later
        subcategory_id: s.r.id,
        category: s.r.category,
        subcategory: s.r.subcategory || "",
        confidence: Number((s.score / maxScore).toFixed(4)),
        source: "heuristic" as const,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
    : [];

  // dynamic enrichment: reuse row tokens against text tokens
  const dynScores = rows.map((r) => {
    const bag = new Set([
      ...tokenize(r.subcategory),
      ...tokenize(r.description ?? ""),
      ...tokenize(r.serviceType ?? ""),
    ]);
    let c = 0;
    for (const t of tokenSet) if (bag.has(t)) c++;
    return { r, c };
  });
  const maxDyn = dynScores.reduce((m, s) => Math.max(m, s.c), 0);
  const dynSugs: Suggestion[] = maxDyn > 0
    ? dynScores.filter((s) => s.c > 0).map((s) => ({
        category_id: null,
        subcategory_id: s.r.id,
        category: s.r.category,
        subcategory: s.r.subcategory || "",
        confidence: Number(Math.min(0.95, 0.5 + 0.12 * s.c).toFixed(4)),
        source: "heuristic" as const,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
    : [];

  // merge
  const merged = [...keywordSugs, ...dynSugs]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
  return merged;
}

async function callGPT(
  taxonomy: TaxonRow[],
  title: string,
  description: string,
): Promise<{ best: Suggestion | null; alternatives: Suggestion[]; model: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_JSON || "";
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const url = "https://api.openai.com/v1/chat/completions";

  // Compress taxonomy to only necessary fields
  const items = taxonomy.map((t) => ({ id: t.id, category: t.category, subcategory: t.subcategory || null }));
  const sys = [
    "Eres un clasificador JSON. Responde solo JSON válido.",
    "Elige la mejor categoría/subcategoría con base en Título/Descripción.",
    "Usa solo IDs y nombres de la TAXONOMÍA proporcionada.",
    "Estructura: { best: { category_id, subcategory_id, category, subcategory, confidence }, alternatives: [..máx 3..] }",
    "confidence entre 0 y 1 (float). Usa 3 alternativas si hay buenas opciones.",
  ].join(" ");
  const user = {
    title,
    description,
    taxonomy: items,
  };

  const body = {
    model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: JSON.stringify(user) },
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
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  const content = j?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return null;
  let parsed: LLMResponse | null = null;
  try { parsed = JSON.parse(content) as LLMResponse; } catch { return null; }
  const best = parsed?.best ?? null;
  const alts = Array.isArray(parsed?.alternatives) ? parsed.alternatives : [];
  const fmt = (x: RawSuggestion | null | undefined): Suggestion | null => {
    if (!x) return null;
    return {
      category_id: x.category_id ?? null,
      subcategory_id: x.subcategory_id ?? null,
      category: String(x.category ?? "") || "",
      subcategory: String(x.subcategory ?? "") || "",
      confidence: Number(x.confidence ?? 0) || 0,
      source: "gpt",
      model,
    } satisfies Suggestion;
  };
  const bestS = fmt(best);
  const altS = alts
    .map((entry) => fmt(entry))
    .filter((sug): sug is Suggestion => Boolean(sug));
  return { best: bestS, alternatives: altS.slice(0, 3), model };
}

function validateAndFillIds(
  sugs: Suggestion[],
  taxonomy: TaxonRow[],
): Suggestion[] {
  const byId = new Map(taxonomy.map((t) => [t.id, t] as const));
  const byPair = new Map(
    taxonomy.map((t) => [
      `${norm(t.category)}|||${norm(t.subcategory)}`,
      t,
    ] as const),
  );
  return sugs.map((s) => {
    let subId: string | null = s.subcategory_id ?? null;
    let cat = (s.category || "").trim();
    let sub = (s.subcategory || "").trim();
    // Fill by ID
    if (subId && byId.has(subId)) {
      const t = byId.get(subId)!;
      cat = t.category;
      sub = t.subcategory || "";
    } else {
      // try to map by names
      const t = byPair.get(`${norm(cat)}|||${norm(sub)}`) || null;
      if (t) subId = t.id;
    }
    return {
      category_id: null, // no separate category_id in current taxonomy
      subcategory_id: subId,
      category: cat,
      subcategory: sub,
      confidence: Math.max(0, Math.min(1, Number(s.confidence || 0))),
      source: s.source,
      model: s.model ?? null,
    } as Suggestion;
  });
}

export async function POST(req: Request) {
  try {
    const ip = ipFrom(req);
    if (!allowRate(ip)) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED", detail: "Too many requests" },
        { status: 429, headers: JSONH },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", detail: parsed.error.message },
        { status: 400, headers: JSONH },
      );
    }
    const { title, description } = parsed.data;

    // Load taxonomy (Supabase or fallback)
    const taxonomy = await loadTaxonomy();
    if (taxonomy.length === 0) {
      return NextResponse.json(
        { ok: true, best: null, alternatives: [] as Suggestion[] },
        { headers: JSONH },
      );
    }

    // Heuristic baseline
    const heuristic = scoreByHeuristics(taxonomy, title, description);

    // GPT pass (optional)
    const gpt = await callGPT(taxonomy, title, description);

    let best: Suggestion | null = null;
    let alternatives: Suggestion[] = [];
    if (gpt && gpt.best) {
      const fixed = validateAndFillIds([gpt.best, ...gpt.alternatives], taxonomy);
      best = fixed[0] ?? null;
      alternatives = fixed.slice(1, 4);
      if (best) best.source = "gpt";
    } else {
      // fallback to heuristic
      const fixed = validateAndFillIds(heuristic, taxonomy);
      best = fixed[0] ?? null;
      alternatives = fixed.slice(1, 4);
    }

    return NextResponse.json(
      {
        ok: true,
        best,
        alternatives,
      },
      { headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
