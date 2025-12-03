import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
    const body = await req.json().catch(() => ({}));
    try {
      // best-effort logging only; do not crash on errors
      console.info("telemetry", { ip, ...body });
    } catch {}
    return NextResponse.json({ ok: true }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}

