import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";
import { fetchExploreRequests } from "@/lib/db/requests";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.max(
      1,
      Math.min(50, Number(url.searchParams.get("limit") || "5")),
    );

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );
    }

    const { items } = await fetchExploreRequests(
      user.id,
      { page: 1, pageSize: limit },
      supabase,
    );
    const minimal = (items || []).slice(0, limit).map((it) => ({
      id: String(it.id),
      title: it.title,
      category: it.category ?? null,
      city: it.city ?? null,
      created_at: it.created_at ?? null,
    }));
    return NextResponse.json({ ok: true, items: minimal }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}
