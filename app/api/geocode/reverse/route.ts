export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

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
  return pick("city", "town", "village", "municipality", "county", "locality", "place");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const latParam = (searchParams.get("lat") || "").toString().trim();
    const lonParam = (searchParams.get("lon") || searchParams.get("lng") || "").toString().trim();
    const lat = toNumber(latParam);
    const lon = toNumber(lonParam);
    if (lat == null || lon == null) {
      return NextResponse.json(
        { ok: false, error: "MISSING_COORDS", detail: "lat and lon are required" },
        { status: 400, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
      );
    }

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("addressdetails", "1");

    const headers: Record<string, string> = {
      Accept: "application/json; charset=utf-8",
      "Content-Type": "application/json; charset=utf-8",
      "Accept-Language": "es,es-MX;q=0.9,en;q=0.8",
      "User-Agent": `handi-webapp/1.0 (${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"})`,
      Referer: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    };

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `reverse_failed_${res.status}` },
        { status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
      );
    }
    const j = (await res.json()) as Record<string, unknown>;
    const address = typeof j?.["display_name"] === "string" ? (j["display_name"] as string) : "";
    const addrObj = j?.["address"] && typeof j["address"] === "object" ? (j["address"] as Record<string, unknown>) : null;
    const city = extractCity(addrObj);

    return NextResponse.json(
      { ok: true, address, city: city ?? null, lat, lon },
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "error" },
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }
}
