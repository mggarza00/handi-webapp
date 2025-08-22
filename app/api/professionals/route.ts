import { NextResponse } from "next/server";

import { getUserOrThrow } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET() {
  await getUserOrThrow(); // requiere sesión
  // TODO: Implementar listado real de profesionales (según RLS/Modelo vigente)
  return NextResponse.json({ ok: true, data: [] }, { headers: JSONH });
}

export async function POST() {
  await getUserOrThrow(); // requiere sesión
  // TODO: Implementar alta/edición de profesional
  return new NextResponse(JSON.stringify({ ok: true }), { status: 201, headers: JSONH });
}
