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
  return (
    CANON.get(n) ??
    (n.includes("san nicolas") ? "San Nicolás" :
     n.includes("escobedo") ? "Escobedo" :
     n.includes("san pedro") ? "San Pedro Garza García" :
     n.includes("santa catarina") ? "Santa Catarina" :
     n.includes("guadalupe") ? "Guadalupe" :
     n.includes("apodaca") ? "Apodaca" :
     n.includes("garcia") ? "García" :
     n.includes("monterrey") ? "Monterrey" : null)
  );
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

  async function queryMapboxOnce(lat: number, lon: number, type: string, token: string) {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lon)},${encodeURIComponent(lat)}.json`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("language", "es");
    url.searchParams.set("types", type);   // single type per request (Mapbox reverse requirement)
    url.searchParams.set("limit", "1");    // reverse supports limit only with single type
    const r = await fetch(url);
    return r;
  }

  try {
    const typesOrder = ["place", "locality", "district", "region"];
    let names = new Set<string>();
    let mapboxOk = false;

    for (const t of typesOrder) {
      const r = await queryMapboxOnce(lat, lon, t, token);
      if (!r.ok) {
        if (r.status === 403) {
          const text = await r.text().catch(() => "");
          return err("MAPBOX_HTTP_403", "Forbidden (check MAPBOX_TOKEN validity/restrictions)", { status: r.status, text });
        }
        const text = await r.text().catch(() => "");
        return err("MAPBOX_HTTP_" + r.status, "Mapbox error", { status: r.status, text });
      }
      const j = await r.json();
      mapboxOk = true;
      const f = (j?.features ?? [])[0];
      if (f) {
        if (typeof f?.text === "string") names.add(f.text);
        if (typeof f?.place_name === "string") f.place_name.split(",").forEach((p: string) => names.add(p.trim()));
        if (Array.isArray(f?.context)) for (const c of f.context) if (typeof c?.text === "string") names.add(c.text);
        for (const n of names) {
          const city = toCanonical(n);
          if (city) {
            try { console.debug("[api/geo/reverse] canonical", { lat, lon, city, type: t }); } catch {}
            return NextResponse.json<ApiOk>({ ok: true, city }, JSONH);
          }
        }
      }
      // continue to next type if not resolved
    }

    if (mapboxOk) {
      const coarse = coarseFallback(lat, lon);
      if (coarse) return NextResponse.json<ApiOk>({ ok: true, city: coarse }, JSONH);
      return err("NO_CANONICAL", "Could not map names to CITIES after type sweep", { names: Array.from(names) });
    }

    // Should not reach here normally due to early error returns
    return err("NO_MAPBOX", "Mapbox unavailable");
  } catch (e: any) {
    return err("EXCEPTION", e?.message ?? String(e));
  }
}

export const dynamic = "force-dynamic";
