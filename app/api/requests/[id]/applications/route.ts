import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// Devuelve las postulaciones de un request.
// RLS permite verlas si eres el dueño del request o el dueño de la postulación.
// Aquí se usa sólo para el dueño del request.
export async function GET(
  req: Request,
  ctx: { params: { id: string } }
) {
  const supabase = supabaseServer();
  const requestId = ctx.params.id;

  const { data, error } = await supabase
    .from("applications")
    .select(`
      id,
      cover_letter,
      proposed_budget,
      status,
      created_at,
      professional:professional_id (
        id,
        headline,
        rating,
        skills
      )
    `)
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, data });
}
