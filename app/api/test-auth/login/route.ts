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
    const email = searchParams.get("email") || "client+seed@handi.dev";
    const next = searchParams.get("next") || "/";

    const admin = getAdminSupabase();
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      return NextResponse.json(
        {
          ok: false,
          error: "GENERATE_LINK_FAILED",
          detail: error?.message || "no_action_link",
        },
        { status: 400, headers: JSONH },
      );
    }
    return NextResponse.json(
      { ok: true, action_link: data.properties.action_link },
      { headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}
