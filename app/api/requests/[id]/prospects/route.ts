import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserOrThrow } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type CtxP = { params: Promise<{ id: string }> };

const IdParam = z.string().uuid();

// Lista prospectos (perfiles) para un request aplicando matching/ranking del DM.
// Implementación via RPC security definer que valida que auth.uid() sea dueño del request.
export async function GET(_req: Request, { params }: CtxP) {
  const { supabase } = await getUserOrThrow();

  const { id: reqId } = await params;
  const id = IdParam.safeParse(reqId);
  if (!id.success) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: JSONH });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc("get_prospects_for_request", { p_request_id: id.data })
    .limit(20);

  if (error) {
    const status = /permission|rls|not authorized/i.test(error.message) ? 403 : 400;
    return new NextResponse(
      JSON.stringify({ ok: false, error: "LIST_FAILED", detail: error.message }),
      { status, headers: JSONH },
    );
  }

  return NextResponse.json({ ok: true, data: data ?? [] }, { headers: JSONH });
}
