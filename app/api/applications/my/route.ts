import { NextResponse } from "next/server";
import { supabaseServer, getUserOrThrow } from "@/lib/supabase-server";

export async function GET(req: Request) {
  try {
    const user = await getUserOrThrow();
    const supabase = supabaseServer();
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");
    if (!requestId) {
      return NextResponse.json({ ok: false, error: "MISSING_REQUEST_ID" }, { status: 400 });
    }

    // Obtener Professional del usuario (si no tiene, devolvemos null sin error)
    const { data: prof, error: e1 } = await supabase
      .from("professionals")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (e1 || !prof?.id) {
      return NextResponse.json({ ok: true, data: null });
    }

    // ¿Existe una application para este request y este professional?
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("request_id", requestId)
      .eq("professional_id", prof.id)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: e?.message ?? "INTERNAL_ERROR" }, { status });
  }
}
