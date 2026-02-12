import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const CACHEH = {
  ...JSONH,
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
} as const;
const MAINTENANCE = process.env.MAINTENANCE_MODE === "true";
const LOG_TIMING = process.env.LOG_TIMING === "1";

export async function GET() {
  const t0 = Date.now();
  try {
    if (MAINTENANCE) {
      return NextResponse.json(
        { ok: false, maintenance: true },
        { status: 503, headers: { ...JSONH, "Cache-Control": "no-store" } },
      );
    }
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
      { headers: CACHEH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  } finally {
    if (LOG_TIMING) {
      // eslint-disable-next-line no-console
      console.info("[timing] /api/catalog/categories", {
        ms: Date.now() - t0,
      });
    }
  }
}

export function POST() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
