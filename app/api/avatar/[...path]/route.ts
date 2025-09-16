import { NextResponse } from "next/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(
  _req: Request,
  { params }: { params: { path?: string[] } },
) {
  const segments = params.path ?? [];
  if (segments.length === 0) {
    return NextResponse.json({ ok: false, error: "MISSING_PATH" }, { status: 400, headers: JSONH });
  }

  const joined = segments.join("/");
  let decoded = joined;
  try {
    decoded = decodeURIComponent(joined);
  } catch {
    decoded = joined;
  }
  const clean = decoded.replace(/^\/+/, "");
  if (!clean) {
    return NextResponse.json({ ok: false, error: "INVALID_PATH" }, { status: 400, headers: JSONH });
  }

  const upstream = `https://lh3.googleusercontent.com/a/${clean}`;
  const res = await fetch(upstream, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; HandiAvatarProxy/1.0)" },
    cache: "no-store",
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: "UPSTREAM_ERROR", status: res.status, body: errBody },
      { status: res.status === 429 ? 200 : res.status, headers: JSONH },
    );
  }

  const body = await res.arrayBuffer();
  const headers = new Headers();
  const type = res.headers.get("content-type") ?? "image/jpeg";
  headers.set("Content-Type", type);
  const cd = res.headers.get("content-disposition");
  if (cd) headers.set("Content-Disposition", cd);
  const cacheControl = res.headers.get("cache-control") ?? "public, max-age=3600";
  headers.set("Cache-Control", cacheControl);

  return new NextResponse(body, { status: 200, headers });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
