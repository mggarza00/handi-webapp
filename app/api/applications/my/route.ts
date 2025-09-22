import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Application } from "@/types/handi";
import { jsonOk, jsonFail } from "@/lib/errors";

/**
 * GET /api/applications/my
 * Retorna las applications del profesional autenticado (RLS activo).
 * Respuesta: { ok: true, data: Application[] }
 */
export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          // En route handlers, Next maneja el set/remove; no-op aquí.
          set() {},
          remove() {},
        },
      },
    );

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) {
      return jsonFail("Unauthorized", 401, { authError: authError?.message });
    }

    // Por RLS solo verá sus propias rows; filtramos por seguridad adicional.
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("professional_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonFail("Failed to fetch applications", 500, {
        dbError: error.message,
      });
    }

    // Tipar explícitamente el arreglo
    const apps: Application[] = (data ?? []) as Application[];
    return jsonOk<Application[]>(apps);
  } catch (e) {
    return jsonFail("Unexpected failure", 500, { error: (e as Error).message });
  }
}
