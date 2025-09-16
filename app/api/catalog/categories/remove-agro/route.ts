import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

function normalizeCat(s: unknown) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export async function POST() {
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("categories_subcategories")
      .select('"Categoría"');
    if (error) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", detail: error.message },
        { status: 500, headers: JSONH },
      );
    }
    const target = new Set(["agricultura", "ganaderia"]);
    const toDelete = Array.from(
      new Set(
        (data || [])
          .map((r) => (r as Record<string, unknown>)["Categoría"])
          .filter((v) => typeof v === "string")
          .filter((v) => target.has(normalizeCat(v as string))),
      ),
    );

    if (toDelete.length === 0) {
      return NextResponse.json(
        { ok: true, deleted: 0, matchedCategories: [] },
        { headers: JSONH },
      );
    }

    const del = await admin
      .from("categories_subcategories")
      .delete()
      .in("Categoría", toDelete)
      .select('"Categoría"'); // para contar
    if (del.error) {
      return NextResponse.json(
        { ok: false, error: "DB_DELETE_ERROR", detail: del.error.message },
        { status: 500, headers: JSONH },
      );
    }
    const count = Array.isArray(del.data) ? del.data.length : null;
    return NextResponse.json(
      { ok: true, deleted: count, matchedCategories: toDelete },
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

export function GET() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
