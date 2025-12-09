import { NextResponse } from "next/server";
import { guessCityFromCoords } from "@/lib/cities";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

function qs(o: Record<string, string>) {
  return new URLSearchParams(o).toString();
}

function getToken() {
  return process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
}

function fromContext(ctx: any[], prefix: string): string | null {
  try {
    const it = ctx?.find((c) => typeof c?.id === 'string' && c.id.startsWith(prefix));
    if (typeof it?.text === 'string' && it.text) return String(it.text);
  } catch {}
  return null;
}

function parseCityFromFeature(f: any): string | null {
  try {
    const ctx: Array<{ id?: string; text?: string }> = (f?.context || []) as any[];
    // prefer locality/place; fallback to region
    const locality = fromContext(ctx, 'locality.');
    if (locality) return locality;
    const place = fromContext(ctx, 'place.');
    if (place) return place;
    const region = fromContext(ctx, 'region.');
    if (region) return region;
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const llRaw = (url.searchParams.get("ll") || "").trim(); // "lng,lat"
  const latRaw = url.searchParams.get("lat") || url.searchParams.get("latitude");
  const lngRaw = url.searchParams.get("lng") || url.searchParams.get("lon") || url.searchParams.get("longitude");
  const language = (url.searchParams.get("language") || "es").trim();
  const limitParam = (url.searchParams.get("limit") || "5").trim();
  const types = (url.searchParams.get("types") || "address,place,locality,neighborhood,poi").trim();
  const country = (url.searchParams.get("country") || "MX").trim();
  const token = getToken();

  try {
    if (q) {
      if (!token) {
        // Degrade gracefully: no geocoding available, but do not error
        return NextResponse.json({ ok: true, results: [] }, { status: 200, headers: JSONH });
      }
      const endpoint = `${BASE}/${encodeURIComponent(q)}.json?${qs({ access_token: token, autocomplete: "true", language, limit: limitParam, country, types })}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        // Degrade gracefully on restricted/forbidden tokens
        return NextResponse.json({ ok: true, results: [] }, { status: 200, headers: JSONH });
      }
      const features: any[] = Array.isArray(j?.features) ? j.features : [];
      const results = features.map((f) => {
        const [lng, lat] = Array.isArray(f?.center) ? f.center : [null, null];
        const ctx = Array.isArray(f?.context) ? f.context : [];
        const city = parseCityFromFeature(f);
        const postcode = fromContext(ctx, 'postcode.');
        const state = fromContext(ctx, 'region.');
        const countryCtx = fromContext(ctx, 'country.');
        return {
          address_line: String(f?.place_name || f?.text || ""),
          place_id: String(f?.id || ""),
          lat: typeof lat === "number" ? lat : null,
          lng: typeof lng === "number" ? lng : null,
          city,
          postcode,
          state,
          country: countryCtx,
          context: ctx,
        };
      });
      return NextResponse.json({ ok: true, results }, { status: 200, headers: JSONH });
    }

    // Reverse: either ll=lng,lat or lat/lng pair
    let lat: number | null = null;
    let lng: number | null = null;
    if (latRaw && lngRaw) {
      lat = Number(latRaw);
      lng = Number(lngRaw);
    } else if (llRaw) {
      const parts = llRaw.split(",").map((s) => Number(s.trim())) as [number, number];
      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        lng = parts[0];
        lat = parts[1];
      }
    }

    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      const pair = `${lng},${lat}`;
      if (!token) {
        const fallbackCity = guessCityFromCoords(lat, lng);
        return NextResponse.json({ ok: true, address_line: null, place_id: null, lat, lng, city: fallbackCity, postcode: null, state: null, country: null, context: [] }, { status: 200, headers: JSONH });
      }
      const endpoint = `${BASE}/${pair}.json?${qs({ access_token: token, language, limit: "1", types })}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        const fallbackCity = guessCityFromCoords(lat, lng);
        if (fallbackCity) {
          return NextResponse.json({ ok: true, address_line: null, place_id: null, lat, lng, city: fallbackCity, postcode: null, state: null, country: null, context: [] }, { status: 200, headers: JSONH });
        }
        return NextResponse.json({ ok: false, error: "MAPBOX_ERROR", detail: j?.message || "reverse_failed" }, { status: 400, headers: JSONH });
      }
      const f = Array.isArray(j?.features) && j.features.length ? j.features[0] : null;
      const ctx = f && Array.isArray(f?.context) ? f.context : [];
      const city = f ? parseCityFromFeature(f) : null;
      const postcode = fromContext(ctx, 'postcode.');
      const state = fromContext(ctx, 'region.');
      const countryCtx = fromContext(ctx, 'country.');
      const out = f
        ? {
            address_line: String(f?.place_name || f?.text || ""),
            place_id: String(f?.id || ""),
            lat: lat!,
            lng: lng!,
            city,
            postcode,
            state,
            country: countryCtx,
            context: ctx,
          }
        : { address_line: null, place_id: null, lat: lat!, lng: lng!, city, postcode: null, state: null, country: null, context: [] };
      return NextResponse.json({ ok: true, ...out }, { status: 200, headers: JSONH });
    }

    return NextResponse.json({ ok: false, error: "Missing q or ll" }, { status: 400, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return new NextResponse(
      JSON.stringify({ ok: false, error: "GEOCODE_FAILED", detail: msg }),
      { status: 500, headers: JSONH },
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
