import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  requestId: z.string().uuid(),
  favorite: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    // (Opcional) Verifica que sea profesional
    const { data: pro } = await supabase
      .from("professionals")
      .select("id")
      .eq("id", user.id)
      .maybeSingle<{ id: string }>();
    if (!pro) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }
    const { requestId, favorite } = parsed.data;

    if (favorite) {
      const { error } = await supabase
        .from("pro_request_favorites")
        .insert({ pro_id: user.id, request_id: requestId });
      // Idempotente: ignorar duplicado
      if (error && (error as any).code !== "23505") {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: JSONH });
      }
      return NextResponse.json({ ok: true, is_favorite: true }, { status: 200, headers: JSONH });
    }

    const { error } = await supabase
      .from("pro_request_favorites")
      .delete()
      .eq("pro_id", user.id)
      .eq("request_id", requestId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: JSONH });
    return NextResponse.json({ ok: true, is_favorite: false }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}
