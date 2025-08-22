import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getErrorMessage } from "@/lib/errors";

/**
 * Healthcheck: verifica envs de Supabase y acceso a DB consultando requests activas (RLS permite 'status=active')
 */
export async function GET() {
  const envMissing: string[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) envMissing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) envMissing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // Si faltan envs críticas, responde de una vez
  if (envMissing.length > 0) {
    return NextResponse.json({ ok: false, env: { missing: envMissing } }, { status: 500 });
  }

  const cookieStore = cookies();
  const supabase = createServerClient(url!, anon!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
    },
  });

  // Probar acceso a DB con una consulta permitida por RLS sin auth: requests status='active'
  let db_ok = false;
  let db_error: string | null = null;
  try {
    const { error } = await supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .limit(1);
    db_ok = !error;
    db_error = error?.message ?? null;
  } catch (e: unknown) {
    db_ok = false;
    db_error = getErrorMessage(e);
  }

  return NextResponse.json({
    ok: db_ok,
    env: { missing: envMissing },
    supabase_url: url,
    db: { ok: db_ok, error: db_error },
    timestamp: new Date().toISOString(),
  }, { status: db_ok ? 200 : 500 });
}
