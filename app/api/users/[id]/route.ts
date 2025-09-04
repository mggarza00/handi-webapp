import { NextResponse } from "next/server";

import { getUserOrThrow, supabaseServer } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type CtxP = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: CtxP) {
  await getUserOrThrow(); // exige sesión (RLS en profiles permite ver solo el propio)
  const supabase = supabaseServer();
  const { id } = await params;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();

  if (error) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "NOT_FOUND", detail: error.message }),
      { status: 404, headers: JSONH },
    );
  }

  return NextResponse.json({ ok: true, data }, { headers: JSONH });
}
