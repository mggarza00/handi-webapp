import { NextResponse } from "next/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

type Body = { role?: "client" | "pro" } | null;

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
    }
    const body = (await req.json().catch(() => null)) as Body;
    const role = (body?.role || "").toString();
    if (role !== "client" && role !== "pro") {
      return NextResponse.json({ ok: false, error: "INVALID_ROLE" }, { status: 400, headers: JSONH });
    }
    const res = NextResponse.json({ ok: true }, { headers: JSONH });
    // 180 days in seconds
    const maxAge = 60 * 60 * 24 * 180;
    res.cookies.set("active_role", role, {
      maxAge,
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR", detail: msg }, { status: 500, headers: JSONH });
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: JSONH });
}

