import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // If SSR already has user, return it
  if (!error && user) {
    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        },
      },
      { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }

  // Dev-only fallback: accept Authorization: Bearer <token> (or x-access-token)
  // to report the user even if cookies are missing.
  try {
    const allowed = process.env.NODE_ENV !== "production" || process.env.CI === "true";
    if (allowed) {
      const h = new Headers(req.headers);
      const auth = h.get("authorization") || "";
      const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
      const xtoken = h.get("x-access-token") || null;
      const token = (bearer || xtoken || "").trim();
      if (token) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        if (url && anon) {
          const client = createClient(url, anon);
          const { data, error: e2 } = await client.auth.getUser(token);
          if (!e2 && data?.user) {
            const u = data.user;
            return NextResponse.json(
              {
                ok: true,
                user: {
                  id: u.id,
                  email: u.email,
                  // user_metadata shape depends on provider; type it loosely
                  name: (u.user_metadata as Record<string, unknown> | null | undefined)?.full_name as string | null ?? null,
                  avatar_url: (u.user_metadata as Record<string, unknown> | null | undefined)?.avatar_url as string | null ?? null,
                },
              },
              { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
            );
          }
        }
      }
    }
  } catch {
    // ignore fallback errors
  }

  // Default: unauthenticated (avoid 401 to reduce noise)
  return NextResponse.json(
    { ok: false, user: null },
    { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
