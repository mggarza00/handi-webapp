import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(req: Request) {
  try {
    const isAllowed =
      process.env.NODE_ENV !== "production" || process.env.CI === "true";
    if (!isAllowed) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN_IN_PROD" },
        { status: 403, headers: JSONH },
      );
    }

    const { searchParams, origin } = new URL(req.url);
    const email = searchParams.get("email") || "cliente.e2e@handi.mx";
    const next = searchParams.get("next") || "/";
    const role = (searchParams.get("role") || "client").toLowerCase();

    let admin: ReturnType<typeof getAdminSupabase> | null = null;
    try {
      admin = getAdminSupabase();
    } catch {
      admin = null;
    }
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    if (admin) {
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
      if (!error && data?.properties?.action_link) {
      type LinkProps = { action_link?: string | null; hashed_token?: string | null };
      const props = (data.properties ?? {}) as LinkProps;
      return NextResponse.json(
        {
          ok: true,
          action_link: props.action_link!,
          token_hash: props.hashed_token ?? null,
          type: "magiclink",
          redirect_to: redirectTo,
        },
        { status: 200, headers: JSONH },
      );
      }
    }

    // Dev fallback: set cookie directly so browser sessions can be established via GET
    const res = NextResponse.json(
      { ok: true, email, role, fallback: "cookie" },
      { status: 200, headers: JSONH },
    );
    res.cookies.set(
      "e2e_session",
      `${encodeURIComponent(email)}:${encodeURIComponent(role)}`,
      { httpOnly: true, path: "/", sameSite: "lax" },
    );
    return res;
  } catch (e) {
    // As fallback, still set cookie-based session to keep tests flowing.
    try {
      const { searchParams, origin } = new URL(req.url);
      const email = searchParams.get("email") || "cliente.e2e@handi.mx";
      const role = (searchParams.get("role") || "client").toLowerCase();
      const res = NextResponse.json(
        { ok: true, email, role, fallback: "cookie" },
        { status: 200, headers: JSONH },
      );
      res.cookies.set(
        "e2e_session",
        `${encodeURIComponent(email)}:${encodeURIComponent(role)}`,
        { httpOnly: true, path: "/", sameSite: "lax" },
      );
      return res;
    } catch {
      const msg = e instanceof Error ? e.message : "UNKNOWN";
      return NextResponse.json(
        { ok: false, error: msg },
        { status: 500, headers: JSONH },
      );
    }
  }
}
