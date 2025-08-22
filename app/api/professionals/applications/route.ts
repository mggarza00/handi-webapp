import { NextResponse } from "next/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type ProblemDetails = {
  ok: false;
  error: "NOT_IMPLEMENTED";
  detail: string;
};

export async function GET() {
  const payload: ProblemDetails = {
    ok: false,
    error: "NOT_IMPLEMENTED",
    detail: "Este endpoint fue deprecado. Usa flujo en Supabase (tabla applications/profiles).",
  };
  return NextResponse.json(payload, { status: 501, headers: JSONH });
}

export async function POST() {
  const payload: ProblemDetails = {
    ok: false,
    error: "NOT_IMPLEMENTED",
    detail: "Registra postulaciones con /api/applications o directamente en Supabase.",
  };
  return NextResponse.json(payload, { status: 501, headers: JSONH });
}
