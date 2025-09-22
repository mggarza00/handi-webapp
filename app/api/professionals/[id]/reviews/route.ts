import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

const QSchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Math.max(1, Math.min(24, parseInt(v, 10))))
    .optional(),
  // cursor format: `${created_at}|${id}`
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
    const limit = qs.data.limit ?? 12;
    const cursor = qs.data.cursor;
    const professionalId = params.id;

    const admin = getAdminSupabase();
    let q = admin
      .from("v_professional_reviews")
      .select(
        "id, professional_id, request_id, client_id, rating, comment, created_at, client_name, client_avatar",
      )
      .eq("professional_id", professionalId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (cursor && cursor.includes("|")) {
      const [cAt, cId] = cursor.split("|");
      if (cAt && cId) {
        q = q.or(`and(created_at.lt.${cAt}),and(created_at.eq.${cAt},id.lt.${cId})`);
      }
    }

    const { data, error } = await q;
    if (error)
      return NextResponse.json(
        { ok: false, error: "FETCH_FAILED", detail: error.message },
        { status: 500, headers: JSONH },
      );

    type Row = {
      id: string;
      client_name: string | null;
      client_avatar: string | null;
      rating: number;
      comment: string | null;
      created_at: string | null;
    };
    const items: Row[] = (data ?? []).map((r) => {
      const rr = r as Record<string, unknown>;
      return {
        id: String(rr.id ?? ""),
        client_name: (rr.client_name as string | null) ?? null,
        client_avatar: (rr.client_avatar as string | null) ?? null,
        rating: Number((rr.rating as number | null) ?? 0),
        comment: (rr.comment as string | null) ?? null,
        created_at: (rr.created_at as string | null) ?? null,
      } satisfies Row;
    });
    const nextCursor = items.length
      ? `${items[items.length - 1].created_at}|${items[items.length - 1].id}`
      : null;
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
