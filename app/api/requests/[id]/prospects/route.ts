import { NextResponse } from "next/server";

import { getUserOrThrow } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

export async function GET(_req: Request, _ctx: Ctx) {
  await getUserOrThrow(); // requiere sesión; RLS aplicará en consultas reales
  // TODO: Matching real; por ahora retornar vacío (evita 404/500)
  return NextResponse.json({ ok: true, data: [] }, { headers: JSONH });
}
