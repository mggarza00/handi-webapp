import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET() {
  try {
    const admin = getAdminSupabase();
    const selectColumns = "*";
    const { data, error } = await admin.from("categories_subcategories").select(selectColumns);

    let rows: unknown[] | null = data;
    let finalError = error;

    if (finalError) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", detail: finalError.message },
        { status: 500, headers: JSONH },
      );
    }

    const safeRows = Array.isArray(rows) ? rows : [];
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
    const pick = (rec: Record<string, unknown>, keys: string[]) => {
      for (const k of keys) {
        const val = rec?.[k];
        if (val !== undefined && val !== null && String(val).trim().length > 0) {
          return String(val).trim();
        }
      }
      return null;
    };
    const normalized = safeRows
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
          icon: (String(rec["Emoji"] ?? "")
            .toString()
            .trim() || null) as string | null,
          iconUrl: pick(rec, ["ícono", "icono", "icon", "icono_url", "icon_url", "iconUrl", "Ícono URL"]),
          image: pick(rec, ["imagen", "image"]),
          color: pick(rec, ["color"]),
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
