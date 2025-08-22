import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServer } from "@/lib/supabase/server";

// Estados permitidos según V1
const StatusEnum = z.enum(["accepted","paid","in_progress","completed","cancelled","disputed"]);

const PatchSchema = z.object({
  status: StatusEnum.optional(),
  amount: z.number().positive().optional(),
}).refine((d) => d.status || d.amount !== undefined, { message: "At least one of {status, amount} is required" });

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const { id } = ctx.params;
    // Validar UUID de path
    const idParse = z.string().uuid().safeParse(id);
    if (!idParse.success) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("application/json")) {
      return NextResponse.json({ ok: false, error: "CONTENT_TYPE_MUST_BE_JSON" }, { status: 415 });
    }

    const json = await req.json();
    const parse = PatchSchema.safeParse(json);
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parse.error.issues }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const update: Record<string, unknown> = {};
    if (parse.data.status) update.status = parse.data.status;
    if (parse.data.amount !== undefined) update.amount = parse.data.amount;

    const { data, error } = await supabase
      .from("agreements")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      // Si RLS bloquea (no es parte del acuerdo) Supabase responde 0 rows; capturamos eso con 404
      return NextResponse.json({ ok: false, error: "UPDATE_FAILED", detail: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, agreement: data }, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
