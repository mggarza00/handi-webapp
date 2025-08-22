import { NextResponse } from "next/server";

import { supabaseServer, getUserOrThrow } from "@/lib/_supabase-server";

type UUID = string;

type MatchItem = {
  id: UUID;
  created_at: string; // ISO
  source: "application" | "agreement" | "recent_profile";
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function GET() {
  try {
    // Crea cliente server-side (por si lo necesitas para queries)
    const _supabase = await supabaseServer();

    // ✅ getUserOrThrow NO recibe argumentos en esta base
    const _user = await getUserOrThrow();

    // TODO: Reemplaza por tu lógica real de matching.
    // De momento respondemos una lista vacía válida para compilar.
    const list: MatchItem[] = [];

    return NextResponse.json({ ok: true, data: list });
  } catch (e: unknown) {
    // Manejo seguro de errores con unknown
    const msg = errorMessage(e);
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
