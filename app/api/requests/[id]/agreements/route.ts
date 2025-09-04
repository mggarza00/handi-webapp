import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

// Lista acuerdos de un request. RLS: sólo dueño del request o profesional involucrado.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = supabaseServer();
  const { id: requestId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("agreements")
    .select("id, professional_id, amount, status, created_at, updated_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "LIST_FAILED", detail: error.message }),
      { status: 400, headers: JSONH },
    );
  }

  return NextResponse.json({ ok: true, data }, { headers: JSONH });
}
