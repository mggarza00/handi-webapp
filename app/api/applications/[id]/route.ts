import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer, getUserOrThrow } from "@/lib/supabase-server";

const patchSchema = z.object({
  status: z.enum(["pending","accepted","rejected"]),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getUserOrThrow();
    const { id } = ctx.params;
    const body = await req.json();
    const { status } = patchSchema.parse(body);

    const supabase = supabaseServer();

    // 1) Traer la aplicación para conocer request_id
    const { data: appRow, error: appErr } = await supabase
      .from("applications")
      .select("id, request_id, status")
      .eq("id", id)
      .single();

    if (appErr || !appRow) {
      return NextResponse.json({ ok: false, error: appErr?.message || "APPLICATION_NOT_FOUND" }, { status: 404 });
    }

    // 2) Actualizar estado de ESTA aplicación
    const { data: updated, error: updErr } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
    }

    // 3) Si se aceptó: cerrar request y rechazar otras
    if (status === "accepted") {
      // 3a) Cerrar el request (solo propietario puede: RLS lo permite)
      await supabase
        .from("requests")
        .update({ status: "closed" })
        .eq("id", appRow.request_id)
        .eq("created_by", user.id);

      // 3b) Rechazar el resto de aplicaciones de ese request
      await supabase
        .from("applications")
        .update({ status: "rejected" })
        .eq("request_id", appRow.request_id)
        .neq("id", id);
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: e?.message ?? "INTERNAL_ERROR" }, { status });
  }
}
