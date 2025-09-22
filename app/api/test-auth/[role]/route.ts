import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { role: string } },
) {
  const allowed =
    process.env.NODE_ENV !== "production" || process.env.CI === "true";
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN_IN_PROD" },
      { status: 403 },
    );
  }

  const { role: r } = params;
  const role = String(r || "guest").toLowerCase();
  if (!["guest", "client", "professional", "admin"].includes(role)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ROLE" },
      { status: 400 },
    );
  }

  const { origin } = new URL(req.url);
  // Redirige al mismo origen del request para que la cookie sea del dominio correcto (preview, prod, etc.)
  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set("handi_role", role, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });
  return res;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
