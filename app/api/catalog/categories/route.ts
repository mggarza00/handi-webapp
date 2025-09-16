import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET() {
  try {
    const admin = getAdminSupabase();
    // Selecciona columnas con nombre exacto y acentos
    const { data, error } = await admin
      .from("categories_subcategories")
      .select('"Categoría","Subcategoría","Activa","Ícono"');
    if (error) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", detail: error.message },
        { status: 500, headers: JSONH },
      );
    }
    const rows = Array.isArray(data) ? data : [];
    const isActive = (v: unknown) => {
      const s = (v ?? "").toString().trim().toLowerCase();
      return (
        s === "sí" ||
        s === "si" ||
        s === "true" ||
        s === "1" ||
        s === "activo" ||
        s === "activa" ||
        s === "x"
      );
    };
    const normalized = rows
      .filter((r) => isActive((r as Record<string, unknown>)["Activa"]))
      .map((r) => {
        const rec = r as Record<string, unknown>;
        return {
          category: String(rec["Categoría"] ?? "")
            .toString()
            .trim(),
          subcategory: (String(rec["Subcategoría"] ?? "")
            .toString()
            .trim() || null) as string | null,
          icon: (String(rec["Ícono"] ?? "")
            .toString()
            .trim() || null) as string | null,
        };
      });
    return NextResponse.json(
      { ok: true, data: normalized },
      { headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export function POST() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
