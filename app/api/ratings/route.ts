import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserOrThrow } from "@/lib/_supabase-server";

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
