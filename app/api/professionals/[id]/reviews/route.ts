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
    const limit = qs.data.limit ?? 5;
    const cursor = qs.data.cursor;
    const professionalId = params.id;

    const admin = getAdminSupabase();
    // Try view first for convenience; fallback to ratings + profiles
    let items: Array<{
      id: string;
      client_name: string | null;
      client_avatar: string | null;
      rating: number;
      comment: string | null;
      created_at: string | null;
    }> = [];

    try {
      let q = admin
        .from("v_professional_reviews" as any)
        .select(
          "id, professional_id, request_id, client_id, rating, comment, created_at, client_name, client_avatar",
        )
        .eq("professional_id", professionalId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (cursor && cursor.includes("|")) {
        const [cAt, cId] = cursor.split("|");
        const isUuid = /^[0-9a-fA-F-]{36}$/.test(cId || "");
        const isDate = !Number.isNaN(Date.parse(cAt || ""));
        if (isUuid && isDate) {
          q = (q as any).or(`and(created_at.lt.${cAt}),and(created_at.eq.${cAt},id.lt.${cId})`);
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      items = (data ?? []).map((r) => {
        const rr = r as Record<string, unknown>;
        return {
          id: String(rr.id ?? ""),
          client_name: (rr.client_name as string | null) ?? null,
          client_avatar: (rr.client_avatar as string | null) ?? null,
          rating: Number((rr.rating as number | null) ?? 0),
          comment: (rr.comment as string | null) ?? null,
          created_at: (rr.created_at as string | null) ?? null,
        };
      });
    } catch {
      // Fallback: ratings by to_user_id + author profiles, with cursor
      let q = admin
        .from("ratings")
        .select("id, from_user_id, stars, comment, created_at")
        .eq("to_user_id", professionalId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (cursor && cursor.includes("|")) {
        const [cAt, cId] = cursor.split("|");
        const isUuid = /^[0-9a-fA-F-]{36}$/.test(cId || "");
        const isDate = !Number.isNaN(Date.parse(cAt || ""));
        if (isUuid && isDate) {
          q = q.or(`and(created_at.lt.${cAt}),and(created_at.eq.${cAt},id.lt.${cId})`);
        }
      }
      const r = await q;
      if (r.error) {
        return NextResponse.json(
          { ok: false, error: "FETCH_FAILED", detail: r.error.message },
          { status: 500, headers: JSONH },
        );
      }
      const rows = r.data ?? [];
      const authorIds = Array.from(new Set(rows.map((x) => (x as any).from_user_id))).filter(Boolean) as string[];
      const profs = authorIds.length
        ? await admin.from("profiles").select("id, full_name, avatar_url").in("id", authorIds)
        : { data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }> };
      const map = new Map((profs.data ?? []).map((a) => [a.id, a]));
      items = rows.map((r) => ({
        id: String((r as any).id),
        client_name: (map.get((r as any).from_user_id)?.full_name as string | null) ?? null,
        client_avatar: (map.get((r as any).from_user_id)?.avatar_url as string | null) ?? null,
        rating: Number(((r as any).stars as number | null) ?? 0),
        comment: ((r as any).comment as string | null) ?? null,
        created_at: ((r as any).created_at as string | null) ?? null,
      }));
    }
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
