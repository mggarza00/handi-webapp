import createClient from "@/utils/supabase/server";
import { jsonFail, jsonOk } from "@/lib/errors";
import type { Application } from "@/types/homaid";

/**
 * GET /api/applications/my
 * Retorna las applications del profesional autenticado (RLS activo).
 * Respuesta: { ok: true, data: Application[] }
 */
export async function GET() {
  try {
    const supabase = createClient();

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
