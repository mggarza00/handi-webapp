import { NextRequest, NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";

import type { Database } from "@/types/supabase";
import { canonicalizeCityName } from "@/lib/cities";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

function getToken() {
  return process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
}

function qs(o: Record<string, string>) {
  return new URLSearchParams(o).toString();
}

function fromContext(ctx: Array<{ id?: string; text?: string }>, prefix: string): string | null {
  try {
    const it = ctx?.find((c) => typeof c?.id === "string" && c.id.startsWith(prefix));
    if (typeof it?.text === "string" && it.text) return String(it.text);
  } catch { /* ignore */ }
  return null;
}

function parseCityFromFeature(f: unknown): string | null {
  try {
    const ctx: Array<{ id?: string; text?: string }> = Array.isArray((f as Record<string, unknown>)?.context)
      ? (((f as Record<string, unknown>).context as unknown[]) as Array<{ id?: string; text?: string }>)
      : [];
    const locality = fromContext(ctx, "locality.");
    if (locality) return locality;
    const place = fromContext(ctx, "place.");
    if (place) return place;
    const region = fromContext(ctx, "region.");
    if (region) return region;
  } catch { /* ignore */ }
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const _cityParam = (url.searchParams.get("city") || "").trim();
  const limitParam = Math.max(1, Math.min(10, Number(url.searchParams.get("limit") || 5)));

  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) return NextResponse.json({ ok: true, items: [] }, { status: 200, headers: JSONH });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supaAny = supabase as any;

    // 1) If no q: return recent (like /recent)
    if (!q) {
      const { data, error } = await supaAny
        .from("user_addresses")
        .select("id,address,city,lat,lon,postal_code,label,last_used_at")
        .eq("profile_id", userId)
        .order("last_used_at", { ascending: false })
        .limit(limitParam);
      if (error) return NextResponse.json({ ok: true, items: [] }, { status: 200, headers: JSONH });
      const items = (data || []).map((r) => ({
        id: r.id as string,
        address: String(r.address || ""),
        city: (canonicalizeCityName(r.city) || r.city || null) as string | null,
        lat: typeof r.lat === "number" ? r.lat : null,
        lon: typeof r.lon === "number" ? r.lon : null,
        postal_code: typeof r.postal_code === "string" ? r.postal_code : null,
        label: typeof r.label === "string" ? r.label : null,
      }));
      return NextResponse.json({ ok: true, items }, { status: 200, headers: JSONH });
    }

    const items: Array<{ id?: string; address: string; city?: string | null; lat?: number | null; lon?: number | null; postal_code?: string | null; label?: string | null }> = [];
    const seen = new Set<string>();
    const norm = (s: string) => s.toLowerCase().trim();
    const push = (it: { id?: string; address: string; city?: string | null; lat?: number | null; lon?: number | null; postal_code?: string | null; label?: string | null }) => {
      const k = norm(it.address || "");
      if (!k || seen.has(k)) return;
      seen.add(k);
      items.push(it);
    };

    // 2) Saved matches ILIKE
    const { data: savedData } = await supaAny
      .from("user_addresses")
      .select("id,address,city,lat,lon,postal_code,label,last_used_at")
      .eq("profile_id", userId)
      .ilike("address", `%${q}%`)
      .order("last_used_at", { ascending: false })
      .limit(limitParam);
    (savedData || []).forEach((r) => push({
      id: r.id as string,
      address: String(r.address || ""),
      city: (canonicalizeCityName(r.city) || r.city || null) as string | null,
      lat: typeof r.lat === "number" ? r.lat : null,
      lon: typeof r.lon === "number" ? r.lon : null,
      postal_code: typeof r.postal_code === "string" ? r.postal_code : null,
      label: typeof r.label === "string" ? r.label : null,
    }));

    // 3) Append Mapbox forward if needed
    const token = getToken();
    if (items.length < limitParam && token) {
      const limitRemain = String(limitParam);
      const endpoint = `${BASE}/${encodeURIComponent(q)}.json?${qs({ access_token: token, language: "es", limit: limitRemain, country: "mx" })}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        const features: Array<Record<string, unknown>> = Array.isArray(j?.features) ? (j.features as Array<Record<string, unknown>>) : [];
        for (const f of features) {
          if (items.length >= limitParam) break;
          const center = (f.center as unknown) as [number, number] | null;
          const [lng, lat] = Array.isArray(center) ? center : [null, null];
          const ctx = Array.isArray(f?.context as unknown) ? ((f.context as unknown[]) as Array<{ id?: string; text?: string }>) : [];
          const rawCity = parseCityFromFeature(f);
          const city = canonicalizeCityName(rawCity) || rawCity || null;
          const address = String((f?.place_name as string) || (f?.text as string) || "");
          const postal_code = fromContext(ctx, "postcode.");
          push({ address, city, lat: typeof lat === "number" ? lat : null, lon: typeof lng === "number" ? lng : null, postal_code: typeof postal_code === 'string' ? postal_code : null });
        }
      }
    }

    return NextResponse.json({ ok: true, items: items.slice(0, limitParam) }, { status: 200, headers: JSONH });
  } catch {
    return NextResponse.json({ ok: true, items: [] }, { status: 200, headers: JSONH });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
