import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

const QSchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Math.max(1, Math.min(20, parseInt(v, 10))))
    .optional(),
  // cursor is free-form; if invalid, we ignore it and serve first page
  cursor: z.string().optional(),
});

export async function GET(req: Request, { params }: Ctx) {
  try {
    const url = new URL(req.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const qs = QSchema.safeParse(raw);
    if (!qs.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_QUERY", detail: qs.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }
    const limit = qs.data.limit ?? 10;
    const cursor = qs.data.cursor;
    const professionalId = params.id;

    const admin = getAdminSupabase();
    let q = admin
      .from("v_professional_jobs")
      .select("request_id, request_title, professional_id, photos")
      .eq("professional_id", professionalId)
      .order("request_id", { ascending: false })
      .limit(limit);
    if (cursor) q = q.lt("request_id", cursor);

    const { data, error } = await q;
    if (error)
      return NextResponse.json(
        { ok: false, error: "FETCH_FAILED", detail: error.message },
        { status: 500, headers: JSONH },
      );

    const items = (data ?? []).map((r) => ({
      request_id: r.request_id as string,
      request_title: r.request_title as string,
      photos: (r.photos as string[] | null) ?? [],
    }));
    const nextCursor = items.length ? items[items.length - 1].request_id : null;
    return NextResponse.json(
      { ok: true, data: items, nextCursor },
      { headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}
