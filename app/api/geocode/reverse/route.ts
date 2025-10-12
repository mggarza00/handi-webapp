import { NextResponse } from "next/server";
import { CITIES } from "@/lib/cities";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase().trim();
}

const CANON = CITIES.map((c) => ({ raw: c, norm: normalize(c) }));
const SYNONYMS: Record<string, string> = {
  "san nicolas de los garza": "San Nicolás",
  "general escobedo": "Escobedo",
  "san pedro garza garcia": "San Pedro Garza García",
  "garcia": "García",
  "santa catarina": "Santa Catarina",
};

function toCanonical(input: string | null | undefined): string | null {
  const v = (input ?? "").toString();
  if (!v) return null;
  const n = normalize(v);
  const direct = CANON.find((x) => x.norm === n)?.raw;
  if (direct) return direct;
  const syn = SYNONYMS[n];
  if (syn) return syn;
  if (n.includes("san nicolas")) return "San Nicolás";
  if (n.includes("escobedo")) return "Escobedo";
  if (n.includes("san pedro")) return "San Pedro Garza García";
  if (n.includes("santa catarina")) return "Santa Catarina";
  if (n.includes("guadalupe")) return "Guadalupe";
  if (n.includes("apodaca")) return "Apodaca";
  if (n.includes("garza garcia")) return "San Pedro Garza García";
  if (n.includes("monterrey")) return "Monterrey";
  if (n.includes("garcia")) return "García";
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  if (!lat || !lon) {
    return NextResponse.json({ ok: false, error: "MISSING_COORDS" }, { status: 400, headers: JSONH });
  }
  try {
    const token = process.env.MAPBOX_TOKEN || "";
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lon)},${encodeURIComponent(lat)}.json`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("language", "es");
    url.searchParams.set("types", "place,locality,region");
    url.searchParams.set("limit", "5");
    const r = await fetch(url, { headers: { "Content-Type": "application/json; charset=utf-8" } });
    const j = await r.json();
    const names: string[] = [];
    for (const f of (j?.features ?? [])) {
      if (typeof f?.text === "string") names.push(f.text);
      if (Array.isArray(f?.context)) {
        for (const c of f.context) if (typeof c?.text === "string") names.push(c.text);
      }
    }
    let city: string | null = null;
    for (const name of names) {
      city = toCanonical(name);
      if (city) break;
    }
    return NextResponse.json({ ok: true, city }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 400, headers: JSONH },
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
