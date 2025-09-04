import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/_supabase-server";

// Devuelve las postulaciones de un request con datos básicos del profesional.
// Usa RPC con security definer que valida: dueño del request o profesional.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = supabaseServer();
  const { id: requestId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc("get_applications_with_profile_basic", { p_request_id: requestId })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, data });
}
