import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: true, route: "/api/health", runtime: "app-router" },
    { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } }
  );
}
# Inserta una línea inválida y prueba commit; debe FALLAR y no crear commit.
