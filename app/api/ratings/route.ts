import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import { getUserOrThrow } from "@/lib/_supabase-server";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  request_id: z.string().uuid(),
  to_user_id: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }

    const { request_id, to_user_id, stars, comment } = parsed.data;

    let supabase; let user;
    try {
      const auth = await getUserOrThrow();
      supabase = auth.supabase;
      user = auth.user;
    } catch {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role =
      profile && typeof profile.role === "string" ? profile.role : null;
    if (role !== "pro" && role !== "client") {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }

    if (role === "pro") {
      const { data: agreement, error } = await supabase
        .from("agreements")
        .select("id")
        .eq("request_id", request_id)
        .eq("professional_id", user.id)
        .maybeSingle();

      if (error || !agreement) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN" },
          { status: 403, headers: JSONH },
        );
      }
    } else {
      const { data: requestRow, error } = await supabase
        .from("requests")
        .select("id, created_by")
        .eq("id", request_id)
        .maybeSingle();

      const owner =
        requestRow && typeof requestRow.created_by === "string"
          ? requestRow.created_by
          : null;

      if (error || owner !== user.id) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN" },
          { status: 403, headers: JSONH },
        );
      }
    }

    const { error: insertError } = await supabase
      .from("ratings")
      .insert([
        {
          request_id,
          from_user_id: user.id,
          to_user_id,
          stars,
          comment: comment?.trim() ? comment.trim() : null,
        },
      ]);

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: "INSERT_FAILED", detail: insertError.message },
        { status: 500, headers: JSONH },
      );
    }

    return NextResponse.json({ ok: true }, { status: 201, headers: JSONH });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500, headers: JSONH },
    );
  }
}

const QuerySchema = z.object({
  to_user_id: z.string().uuid(),
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
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const qs = Object.fromEntries(url.searchParams.entries());
    const parsed = QuerySchema.safeParse(qs);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }

    const { to_user_id, limit, offset, aggregate } = parsed.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as
      | string
      | undefined;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as
      | string
      | undefined;
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { ok: false, error: "SERVER_MISCONFIGURED" },
        { status: 500, headers: JSONH },
      );
    }

    const admin = createClient<Database>(supabaseUrl, serviceRole);

    const pageSize = limit ?? 10;
    const from = offset ?? 0;
    const to = from + pageSize - 1;

    const listPromise = admin
      .from("ratings")
      .select("id, request_id, from_user_id, to_user_id, stars, comment, created_at")
      .eq("to_user_id", to_user_id)
      .order("created_at", { ascending: false })
      .range(from, to);

    const aggPromise = aggregate
      ? admin
          .from("ratings")
          .select("stars", { count: "exact", head: false })
          .eq("to_user_id", to_user_id)
      : null;

    const [{ data: rows, error: listError }, agg] = await Promise.all([
      listPromise,
      aggPromise,
    ]);

    if (listError) {
      return NextResponse.json(
        { ok: false, error: "FETCH_FAILED", detail: listError.message },
        { status: 500, headers: JSONH },
      );
    }

    let summary: { count: number; average: number | null } | undefined;
    if (aggregate) {
      const count = (agg?.count as number | null) ?? 0;
      let average: number | null = null;
      if (count > 0 && Array.isArray(agg?.data)) {
        const nums = (agg!.data as Array<{ stars: number }>).map((r) => r.stars);
        if (nums.length) {
          const sum = nums.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
          average = sum / nums.length;
        }
      }
      summary = { count, average };
    }

    return NextResponse.json(
      { ok: true, data: rows ?? [], summary },
      { status: 200, headers: JSONH },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 500, headers: JSONH },
    );
  }
}
