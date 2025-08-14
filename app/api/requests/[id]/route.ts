import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer, getUserOrThrow } from "@/lib/supabase-server";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const supabase = supabaseServer();
  const id = ctx.params.id;

  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data });
}

const patchSchema = z.object({ status: z.enum(["active","closed"]) });

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getUserOrThrow();
    const { status } = patchSchema.parse(await req.json());
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", ctx.params.id)
      .eq("created_by", user.id)   // extra safety además de RLS
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    const code = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: e?.message ?? "INTERNAL_ERROR" }, { status: code });
  }
}
