export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { CITIES } from "@/lib/cities";

type ApiOk = { ok: true; city: string | null };
type ApiErr = { ok: false; code: string; message: string; details?: any };

const JSONH = { headers: { "Content-Type": "application/json; charset=utf-8" } } as const;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase().trim();

const CANON = new Map(CITIES.map((c) => [normalize(c), c]));
const toCanonical = (raw?: string | null): string | null => {
  const n = normalize(String(raw ?? ""));

  // 1) Exact canonical map
  const direct = CANON.get(n);
  if (direct) return direct;

  // 2) High-priority synonyms (must come BEFORE generic matches)
  if (n.includes("garza garcia")) {
    try { console.debug("[api/geo/reverse] toCanonical: garza garcia -> SPGG", { raw }); } catch {}
    return "San Pedro Garza García";
  }
  if (n.includes("san pedro")) return "San Pedro Garza García";
  if (n.includes("san nicolas")) return "San Nicolás";
  if (n.includes("general escobedo")) return "Escobedo";
  if (n.includes("santa catarina")) return "Santa Catarina";

  // 3) Common direct names
  if (n.includes("monterrey")) return "Monterrey";
  if (n.includes("guadalupe")) return "Guadalupe";
  if (n.includes("apodaca")) return "Apodaca";

  // 4) Generic "garcia" MUST be last to avoid catching "garza garcia"
  if (n.includes("escobedo")) return "Escobedo";
  if (n.includes("garcia")) return "García";

  return null;
};

function err(code: string, message: string, details?: any) {
  try { console.warn("[api/geo/reverse]", code, message, details ?? ""); } catch {}
  return NextResponse.json<ApiErr>({ ok: false, code, message, details }, { status: 400, ...JSONH });
}

// OPTIONAL: coarse fallback by lat/lon (NL metro)
function coarseFallback(lat: number, lon: number): string | null {
  if (lat > 25.60 && lat < 25.80 && lon > -100.40 && lon < -100.20) return "Monterrey";
  if (lat > 25.62 && lat < 25.71 && lon > -100.44 && lon < -100.34) return "San Pedro Garza García";
  if (lat > 25.68 && lat < 25.77 && lon > -100.33 && lon < -100.22) return "San Nicolás";
  if (lat > 25.63 && lat < 25.76 && lon > -100.28 && lon < -100.15) return "Guadalupe";
  if (lat > 25.76 && lat < 25.90 && lon > -100.38 && lon < -100.26) return "Escobedo";
  if (lat > 25.62 && lat < 25.75 && lon > -100.53 && lon < -100.42) return "Santa Catarina";
  if (lat > 25.70 && lat < 25.85 && lon > -100.60 && lon < -100.48) return "García";
  if (lat > 25.70 && lat < 25.88 && lon > -100.33 && lon < -100.16) return "Apodaca";
  return null;
}

export async function GET(req: Request) {
  const search = new URL(req.url).searchParams;
  const latParam = search.get("lat");
  const lonParam = search.get("lon") ?? search.get("lng");
  if (!latParam || !lonParam) return err("MISSING_COORDS", "lat and lon/lng are required");

  const lat = Number(latParam), lon = Number(lonParam);
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return err("BAD_COORDS", "lat/lon must be finite numbers", { latParam, lonParam });

  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    const coarse = coarseFallback(lat, lon);
    if (coarse) return NextResponse.json<ApiOk>({ ok: true, city: coarse }, JSONH);
    return err("NO_MAPBOX_TOKEN", "Missing MAPBOX_TOKEN on server env");
  }

  // example:
  // curl "https://api.mapbox.com/geocoding/v5/mapbox.places/-100.3161,25.6866.json?types=place&limit=1&access_token=$MAPBOX_TOKEN"

  // Candidate scoring helpers to pick best canonical city
  type Candidate = {
    raw: string;
    canonical: string | null;
    placeTypeScore: number;   // place=3, locality=2, district=1, region=0, unknown=-1
    distanceKm: number;       // haversine between (lat,lon) and feature.center
    relevance: number;        // from Mapbox or 0
    inBbox: boolean;          // point ∈ bbox if provided
  };

  function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function ptInBbox(lat: number, lon: number, bbox?: number[]): boolean {
    if (!Array.isArray(bbox) || bbox.length !== 4) return false;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
  }

  function placeTypePriority(t?: string[]): number {
    if (!t || !t.length) return -1;
    const s = t[0];
    if (s === "place") return 3;
    if (s === "locality") return 2;
    if (s === "district") return 1;
    if (s === "region") return 0;
    return -1;
  }

  function score(c: Candidate): number {
    const bboxBoost = c.inBbox ? 100 : 0;
    const distPenalty = Math.min(50, c.distanceKm);
    return bboxBoost + c.placeTypeScore * 10 + (c.relevance || 0) - distPenalty;
  }

  // Multi-candidate sweep by type with limit=5 to compare
  async function mapboxReverseSweep(lat: number, lon: number, token: string): Promise<Candidate[]> {
    const typesOrder = ["place", "locality", "district", "region"];
    const candidates: Candidate[] = [];

    for (const type of typesOrder) {
      const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lon)},${encodeURIComponent(lat)}.json`);
      url.searchParams.set("access_token", token);
      url.searchParams.set("language", "es");
      url.searchParams.set("types", type);
      url.searchParams.set("limit", "5");

      const r = await fetch(url);
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        if (r.status === 403) throw Object.assign(new Error("MAPBOX_HTTP_403"), { status: r.status, text });
        throw Object.assign(new Error("MAPBOX_HTTP_" + r.status), { status: r.status, text });
      }
      const j = await r.json();
      const feats: any[] = Array.isArray(j?.features) ? j.features : [];
      for (const f of feats) {
        const center = Array.isArray(f?.center) ? (f.center as number[]) : null;
        if (!center || center.length < 2) continue;
        const [fcLon, fcLat] = center;
        const dKm = haversineKm(lat, lon, fcLat, fcLon);
        const inB = ptInBbox(lat, lon, f?.bbox as number[] | undefined);
        const pscore = placeTypePriority(f?.place_type as string[] | undefined);
        const rel = typeof f?.relevance === "number" ? (f.relevance as number) : 0;

        if (typeof f?.text === "string" && f.text) {
          candidates.push({ raw: f.text, canonical: toCanonical(f.text), placeTypeScore: pscore, distanceKm: dKm, relevance: rel, inBbox: inB });
        }
        if (Array.isArray(f?.context)) {
          for (const c of f.context) {
            const ctxText = typeof c?.text === "string" ? (c.text as string) : "";
            if (!ctxText) continue;
            const ctxId = typeof c?.id === "string" ? (c.id as string) : "";
            const ctxType = ctxId.includes(".") ? ctxId.split(".")[0] : "";
            if (!["place", "locality", "district"].includes(ctxType)) continue;
            candidates.push({ raw: ctxText, canonical: toCanonical(ctxText), placeTypeScore: placeTypePriority([ctxType]), distanceKm: dKm, relevance: rel, inBbox: inB });
          }
        }
        if (typeof f?.place_name === "string" && f.place_name) {
          for (const part of (f.place_name as string).split(",")) {
            const name = part.trim();
            if (!name) continue;
            candidates.push({ raw: name, canonical: toCanonical(name), placeTypeScore: pscore, distanceKm: dKm, relevance: rel, inBbox: inB });
          }
        }
      }
      // Continue to next type; final selection happens after accumulating
    }
    return candidates;
  }

  try {
    const cands = await mapboxReverseSweep(lat, lon, token);
    const canonCands = cands.filter((c) => !!c.canonical) as Candidate[];
    if (canonCands.length) {
      const inB = canonCands.filter((c) => c.inBbox);
      const pool = inB.length ? inB : canonCands;
      pool.sort((a, b) => score(b) - score(a));
      const best = pool[0]!;
      try { console.debug("[api/geo/reverse] pick", { city: best.canonical, raw: best.raw, distanceKm: best.distanceKm.toFixed(2) }); } catch {}
      return NextResponse.json<ApiOk>({ ok: true, city: best.canonical! }, JSONH);
    }
    // If none canonical from Mapbox, DO NOT coarse fallback here; (optional) place OSM fallback here
    return err("NO_CANONICAL", "Could not resolve a canonical city from Mapbox", {});
  } catch (e: any) {
    if (e?.message && String(e.message).startsWith("MAPBOX_HTTP_")) {
      return err(e.message, "Mapbox error", { status: e.status, text: e.text });
    }
    return err("EXCEPTION", e?.message ?? String(e));
  }
}

export const dynamic = "force-dynamic";
