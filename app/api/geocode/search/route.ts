// app/api/geocode/search/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

function extractCity(addr: Record<string, unknown> | null | undefined): string | null {
  if (!addr || typeof addr !== "object") return null;
  const a = addr as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const val = a[k];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
    return null;
  };
  // Try common Nominatim address levels for city/locality
  return (
    pick("city", "town", "village", "municipality", "county", "locality", "place") || null
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").toString().trim();
    if (!q) return NextResponse.json(
      { ok: false, error: "Missing q" },
      { status: 400, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
    );

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    url.searchParams.set("q", q);

    const headers: Record<string, string> = {
      Accept: "application/json; charset=utf-8",
      "Content-Type": "application/json; charset=utf-8",
      "Accept-Language": "es,es-MX;q=0.9,en;q=0.8",
      "User-Agent": `handi-webapp/1.0 (${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"})`,
      Referer: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    };

    const res = await fetch(url.toString(), {
      headers,
      // Avoid hard caching on Vercel edge by intermediaries; we can add s-maxage below
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `geocode_failed_${res.status}` },
        { status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
      );
    }
    const data = (await res.json()) as Array<Record<string, unknown>>;

    const results = (Array.isArray(data) ? data : [])
      .map((it) => {
        const lat = toNumber((it as any)?.lat);
        const lon = toNumber((it as any)?.lon);
        const label = typeof (it as any)?.display_name === "string" ? ((it as any).display_name as string) : "";
        const address = (it as any)?.address && typeof (it as any).address === "object" ? ((it as any).address as Record<string, unknown>) : undefined;
        const city = address ? extractCity(address) : null;
        return { label, lat, lon, address, city } as { label: string; lat: number | null; lon: number | null; address?: any; city?: string | null };
      })
      .filter((x) => typeof x.lat === "number" && typeof x.lon === "number")
      .map((x) => ({ label: x.label, lat: x.lat as number, lon: x.lon as number, address: x.address, city: x.city ?? undefined }));

    return NextResponse.json(
      { ok: true, data: results },
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "error" },
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }
}
