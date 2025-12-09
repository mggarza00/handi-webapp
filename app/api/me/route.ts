import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";

export async function GET(req: Request) {
  // Minimal e2e cookie-based auth fallback
  try {
    const raw = req.headers.get("cookie") || "";
    const parts = raw.split(/;\s*/);
    const e2e = parts.find((c) => c.startsWith("e2e_session="));
    if (e2e) {
      const val = decodeURIComponent(e2e.split("=")[1] || "");
      const [email, role] = val.split(":");
      if (email) {
        return NextResponse.json(
          {
            ok: true,
            user: {
              id: email, // fallback id derived from email
              email,
              role: role || "client",
              name: null,
              avatar_url: null,
            },
          },
          { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
        );
      }
    }
  } catch {
    // ignore
  }
  const supabase = createClient();
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

  // Nota: se elimina fallback por Authorization Bearer para forzar sincronización de cookies vía /api/auth/sync

  // Default: unauthenticated (avoid 401 to reduce noise)
  return NextResponse.json(
    { ok: false, user: null },
    { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
