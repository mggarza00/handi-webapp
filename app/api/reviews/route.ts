import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import { getUserOrThrow } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

// ============
// POST /api/reviews (client -> pro)
// Body: { request_id, reviewer_role: 'client', rating (1..5), comment?, professional_id }
// ============
const PostSchema = z.object({
  request_id: z.string().uuid(),
  reviewer_role: z.enum(["client"]).default("client"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  professional_id: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const r = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const body = {
      request_id: r["request_id"] ?? r["requestId"],
      reviewer_role: r["reviewer_role"] ?? r["reviewerRole"] ?? "client",
      rating: r["rating"] ?? r["stars"],
      comment: r["comment"],
      professional_id: r["professional_id"] ?? r["professionalId"],
    } as Record<string, unknown>;
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }
    const { request_id, rating, comment, professional_id } = parsed.data;

    const { supabase, user } = await getUserOrThrow();

    const { data: reqRow } = await supabase
      .from("requests")
      .select("id, created_by, status")
      .eq("id", request_id)
      .maybeSingle<{ id: string; created_by: string; status: string | null }>();
    if (!reqRow || reqRow.created_by !== user.id || reqRow.status !== "completed") {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }
    const { data: ag } = await supabase
      .from("agreements")
      .select("id")
      .eq("request_id", request_id)
      .eq("professional_id", professional_id)
      .maybeSingle();
    if (!ag) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }

    const { error: insErr } = await supabase.from("reviews").insert([
      {
        request_id,
        client_id: user.id,
        professional_id,
        rating,
        comment: comment && String(comment).trim() ? String(comment).trim() : null,
      } as never,
    ] as never);
    if (insErr) {
      const code = /duplicate|unique/i.test(insErr.message) ? 409 : 500;
      return NextResponse.json(
        { ok: false, error: "INSERT_FAILED", detail: insErr.message },
        { status: code, headers: JSONH },
      );
    }
    return NextResponse.json({ ok: true }, { status: 201, headers: JSONH });
  } catch {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500, headers: JSONH },
    );
  }
}

// ============
// GET /api/reviews
// Query params: professional_id?, client_id?, request_id?, limit?, offset?, aggregate?
// Lists from public.reviews. If aggregate=1, returns count+average for the filter.
// ============
const GetSchema = z
  .object({
    professional_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    request_id: z.string().uuid().optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform((v) => Math.max(1, Math.min(50, parseInt(v, 10))))
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/)
      .transform((v) => Math.max(0, parseInt(v, 10)))
      .optional(),
    aggregate: z
      .string()
      .optional()
      .transform((v) => (v === "1" || v === "true" ? true : false)),
  })
  .refine((v) => Boolean(v.professional_id || v.client_id || v.request_id), {
    message: "At least one filter is required",
  });

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const qs = Object.fromEntries(url.searchParams.entries()) as Record<string, string>;
    if (!qs.request_id && qs.requestId) qs.request_id = qs.requestId;
    if (!qs.professional_id && qs.professionalId) qs.professional_id = qs.professionalId;
    if (!qs.client_id && qs.clientId) qs.client_id = qs.clientId;
    const parsed = GetSchema.safeParse(qs);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }

    const { professional_id, client_id, request_id, limit, offset, aggregate } = parsed.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { ok: false, error: "SERVER_MISCONFIGURED" },
        { status: 500, headers: JSONH },
      );
    }
    const admin = createClient<Database>(supabaseUrl, serviceRole);

    let q = admin
      .from("reviews")
      .select("id, request_id, professional_id, client_id, rating, comment, created_at")
      .order("created_at", { ascending: false });
    if (professional_id) q = q.eq("professional_id", professional_id);
    if (client_id) q = q.eq("client_id", client_id);
    if (request_id) q = q.eq("request_id", request_id);

    const pageSize = limit ?? 10;
    const from = offset ?? 0;
    const to = from + pageSize - 1;
    const { data: rows, error: listErr } = await q.range(from, to);
    if (listErr) {
      return NextResponse.json(
        { ok: false, error: "FETCH_FAILED", detail: listErr.message },
        { status: 500, headers: JSONH },
      );
    }

    let summary: { count: number; average: number | null } | undefined;
    if (aggregate) {
      if (professional_id) {
        const agg = await admin
          .from("reviews")
          .select("rating", { count: "exact", head: false })
          .eq("professional_id", professional_id);
        const count = (agg.count as number | null) ?? 0;
        let average: number | null = null;
        if (count > 0 && Array.isArray(agg.data)) {
          const nums = (agg.data as Array<{ rating: number }>).map((r) => r.rating);
          if (nums.length) {
            const sum = nums.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
            average = sum / nums.length;
          }
        }
        summary = { count, average };
      } else if (client_id) {
        const agg = await admin
          .from("reviews")
          .select("rating", { count: "exact", head: false })
          .eq("client_id", client_id);
        const count = (agg.count as number | null) ?? 0;
        let average: number | null = null;
        if (count > 0 && Array.isArray(agg.data)) {
          const nums = (agg.data as Array<{ rating: number }>).map((r) => r.rating);
          if (nums.length) {
            const sum = nums.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
            average = sum / nums.length;
          }
        }
        summary = { count, average };
      }
    }

    return NextResponse.json(
      { ok: true, data: rows ?? [], summary },
      { status: 200, headers: JSONH },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500, headers: JSONH },
    );
  }
}
