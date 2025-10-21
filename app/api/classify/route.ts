import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { HEURISTICS_MAP as STATIC_HEURISTICS_MAP } from "@/app/api/classify/heuristics.generated";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const InputSchema = z
  .object({
    title: z.string().optional().default(""),
    description: z.string().optional().default(""),
  })
  .refine((v) => (v.title?.trim() || v.description?.trim())?.length, {
    message: "title or description required",
    path: ["title"],
  });

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
  // comunes en español: "aciones" -> "acion" (instalaciones -> instalacion)
  t = t.replace(/aciones$/i, "acion");
  t = t.replace(/ciones$/i, "cion");
  // plural simples
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
  // dedup
  return Array.from(new Set(toks));
}

type Row = {
  category: string;
  subcategory: string;
  description: string;
  serviceType: string;
  active: boolean;
};

type Suggestion = {
  category: string;
  subcategory: string; // non-null string; may be empty if not provided
  confidence: number; // 0..1
  source: "keyword" | "heuristic";
};

type HeuristicEntry = {
  category: string;
  subcategory: string;
  keywords: string[];
};

// Heurística estática generada (puede ser reemplazada por scripts/generate-heuristics.ts)
const HEURISTICS_MAP: Record<string, string> = STATIC_HEURISTICS_MAP;

const HEURISTICS: HeuristicEntry[] = [
  // albañilería > loseta y azulejo
  {
    category: "Albañilería",
    subcategory: "Loseta y azulejo",
    keywords: ["loseta", "azulejo", "boquilla", "cerámica", "porcelanato"],
  },
  // electricidad > instalación de luminarias
  {
    category: "Electricidad",
    subcategory: "Instalación de luminarias",
    keywords: ["foco", "lámpara", "spot", "plafón", "iluminación"],
  },
  // plomería > fugas y reparaciones
  {
    category: "Plomería",
    subcategory: "Fugas y reparaciones",
    keywords: ["fuga", "tubería", "mezcladora", "regadera", "wc", "inodoro"],
  },
  // cortinas y persianas > instalación
  {
    category: "Cortinas y persianas",
    subcategory: "Instalación",
    keywords: ["persiana", "cortinas", "blackout", "estores", "cortinero"],
  },
];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as unknown));
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", detail: parsed.error.message },
        { status: 400, headers: JSONH },
      );
    }

    const { title, description } = parsed.data;
    const titleTokens = tokenize(title);
    const descTokens = tokenize(description ?? "");
    const allTokens = new Set([...titleTokens, ...descTokens]);
    if (allTokens.size === 0) {
      return NextResponse.json(
        { ok: true, best: null, suggestions: [] as Suggestion[] },
        { headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("categories_subcategories")
      .select(
        '"Categoría","Subcategoría","Descripción","Activa","Ícono","Tipo de servicio","Nivel de especialización"',
      );
    if (error) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", detail: error.message },
        { status: 500, headers: JSONH },
      );
    }

    const isActive = (v: unknown) => {
      const s = String(v ?? "").trim().toLowerCase();
      return (
        s === "sí" ||
        s === "si" ||
        s === "true" ||
        s === "1" ||
        s === "activo" ||
        s === "activa" ||
        s === "x"
      );
    };

    const rows: Row[] = (Array.isArray(data) ? data : []).map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        category: String(rec["Categoría"] ?? "").trim(),
        subcategory: String(rec["Subcategoría"] ?? "").trim(),
        description: String(rec["Descripción"] ?? "").trim(),
        serviceType: String(rec["Tipo de servicio"] ?? "").trim(),
        active: isActive(rec["Activa"]),
      } satisfies Row;
    });

    const activeRows = rows.filter((r) => r.active && r.category);
    if (activeRows.length === 0) {
      return NextResponse.json(
        { ok: true, best: null, suggestions: [] as Suggestion[] },
        { headers: JSONH },
      );
    }

    // Build per-row keyword sets
    const rowKeywords = activeRows.map((r) => {
      const kwSub = new Set(tokenize(r.subcategory));
      const kwDesc = new Set(tokenize(r.description));
      const kwType = new Set(tokenize(r.serviceType));
      return { r, kwSub, kwDesc, kwType };
    });

    const tTokens = new Set(titleTokens);
    const dTokens = new Set(descTokens);

    // Score function with simple weights
    const suggestionsRaw = rowKeywords.map(({ r, kwSub, kwDesc, kwType }) => {
      let score = 0;
      // Subcategory keywords match strongly
      for (const k of kwSub) {
        if (tTokens.has(k)) score += 3.0;
        if (dTokens.has(k)) score += 2.0;
      }
      // Type of service moderately
      for (const k of kwType) {
        if (tTokens.has(k)) score += 2.0;
        if (dTokens.has(k)) score += 1.0;
      }
      // Description lightly
      for (const k of kwDesc) {
        if (tTokens.has(k)) score += 1.2;
        if (dTokens.has(k)) score += 0.8;
      }

      // Small bonus: whole-word subcategory string inside title/desc
      const subNorm = norm(r.subcategory);
      if (subNorm && (norm(title).includes(subNorm) || norm(description).includes(subNorm))) {
        score += 2.5;
      }

      return { r, score };
    });

    const maxScore = suggestionsRaw.reduce((m, s) => Math.max(m, s.score), 0);
    const suggestionsKeyword: Suggestion[] = maxScore > 0
      ? suggestionsRaw
          .filter((s) => s.score > 0)
          .map((s) => ({
            category: s.r.category,
            subcategory: s.r.subcategory || "",
            confidence: Number((s.score / maxScore).toFixed(4)),
            source: "keyword" as const,
          }))
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 10)
      : [];

    // Heuristics scoring: count keyword hits per (category, subcategory)
    const tokenSet = new Set([...tTokens, ...dTokens]);
    const hits = new Map<string, { cat: string; sub: string; count: number }>();
    for (const h of HEURISTICS) {
      const kws = new Set(h.keywords.map((k) => stem(norm(k))));
      let c = 0;
      for (const t of tokenSet) if (kws.has(t)) c++;
      if (c > 0) {
        const key = `${h.category}|||${h.subcategory}`;
        const prev = hits.get(key);
        hits.set(key, { cat: h.category, sub: h.subcategory, count: (prev?.count ?? 0) + c });
      }
    }
    const maxHit = Array.from(hits.values()).reduce((m, x) => Math.max(m, x.count), 0);
    // Base por lista estática de heurísticas
    const suggestionsHeuristicStatic: Suggestion[] = maxHit > 0
      ? Array.from(hits.values())
          .map((x) => ({
            category: x.cat,
            subcategory: x.sub,
            // map count to confidence: min(0.95, 0.55 + 0.15 * count)
            confidence: Number(Math.min(0.95, 0.55 + 0.15 * x.count).toFixed(4)),
            source: "heuristic" as const,
          }))
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 10)
      : [];

    // Heurística dinámica: enriquecer mapa heurístico con tokens derivados de la descripción
    // y tipo de servicio por cada subcategoría activa.
    const enrichedMap = new Map<string, Set<string>>(); // subNorm -> keywords
    // Semilla desde HEURISTICS_MAP (estática)
    for (const [k, words] of Object.entries(HEURISTICS_MAP)) {
      const set = enrichedMap.get(k) ?? new Set<string>();
      for (const w of words.split(/[,\s]+/)) {
        const n = stem(norm(w));
        if (n) set.add(n);
      }
      enrichedMap.set(k, set);
    }
    // Enriquecimiento desde el catálogo: tokens de descripción, tipo y subcategoría
    for (const r of activeRows) {
      const keySub = norm(r.subcategory);
      const set = enrichedMap.get(keySub) ?? new Set<string>();
      const descTokens = tokenize(r.description).filter((t) => t.length >= 3);
      const typeTokens = tokenize(r.serviceType).filter((t) => t.length >= 3);
      const subTokens = tokenize(r.subcategory).filter((t) => t.length >= 3);
      for (const t of [...descTokens.slice(0, 8), ...typeTokens.slice(0, 5), ...subTokens.slice(0, 3)]) {
        set.add(t);
      }
      enrichedMap.set(keySub, set);
    }

    // Puntuar con mapa enriquecido
    const dynHits = new Map<string, { cat: string; sub: string; count: number }>();
    for (const r of activeRows) {
      const keySub = norm(r.subcategory);
      const kws = enrichedMap.get(keySub);
      if (!kws || kws.size === 0) continue;
      let c = 0;
      for (const t of tokenSet) if (kws.has(t)) c++;
      if (c > 0) {
        const key = `${r.category}|||${r.subcategory}`;
        const prev = dynHits.get(key);
        dynHits.set(key, { cat: r.category, sub: r.subcategory, count: (prev?.count ?? 0) + c });
      }
    }
    const maxDyn = Array.from(dynHits.values()).reduce((m, x) => Math.max(m, x.count), 0);
    const suggestionsHeuristicDyn: Suggestion[] = maxDyn > 0
      ? Array.from(dynHits.values())
          .map((x) => ({
            category: x.cat,
            subcategory: x.sub,
            confidence: Number(Math.min(0.95, 0.50 + 0.12 * x.count).toFixed(4)),
            source: "heuristic" as const,
          }))
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 10)
      : [];

    // Merge and pick best
    const suggestions = [
      ...suggestionsKeyword,
      ...suggestionsHeuristicStatic,
      ...suggestionsHeuristicDyn,
    ]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
    if (suggestions.length === 0) {
      return NextResponse.json(
        { ok: true, best: null, suggestions: [] as Suggestion[] },
        { headers: JSONH },
      );
    }
    const best = suggestions[0] ?? null;

    return NextResponse.json({ ok: true, best, suggestions }, { status: 200, headers: JSONH });
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
