import { NextResponse } from "next/server";
import { getUserOrThrow } from "@/lib/supabase-server";

const allowed = ["active","in_process","completed","cancelled"] as const;
type ReqStatus = (typeof allowed)[number];

/**
 * PATCH /api/requests/:id
 * Actualiza el status de una solicitud. RLS asegura que solo el dueño puede actualizar.
 * Body: { status: "active" | "in_process" | "completed" | "cancelled" }
 */
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const { supabase, user } = await getUserOrThrow();
    const body = await req.json().catch(() => ({} as any));
    const status: ReqStatus = body?.status;

    if (!allowed.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", ctx.params.id)
      .eq("created_by", user.id) // extra safety además de RLS
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, request: data });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * GET /api/requests/:id
 * Devuelve la solicitud si es activa o si es del usuario autenticado (RLS lo controla).
 */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const { supabase } = await getUserOrThrow(); // si no hay sesión, 401
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("id", ctx.params.id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, request: data });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
