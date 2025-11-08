import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import getRouteClient from "@/lib/supabase/route-client";

import type { Database } from "@/types/supabase";
import { createBearerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  requestId: z.string().uuid(),
  favorite: z.boolean(),
});

function readAccessTokenFromCookies(): string | null {
  const ck = cookies();
  // New cookie name used by supabase helpers
  const token = ck.get("sb-access-token")?.value || ck.get("sb:token")?.value;
  if (token) return token;
  // Legacy cookie (json-encoded)
  const legacy = ck.get("supabase-auth-token")?.value;
  if (legacy) {
    try {
      const parsed = JSON.parse(decodeURIComponent(legacy));
      return (
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        null
      );
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const supabase = getRouteClient();
    let { data: auth } = await supabase.auth.getUser();
    let user = auth.user;

    // Fallback: try bearer token from cookies when auth-helpers session is not detected
    let db: any = supabase as any;
    if (!user) {
      const token = readAccessTokenFromCookies();
      if (token) {
        const bearer = createBearerClient(token);
        const got = await bearer.auth.getUser(token);
        user = got.data.user ?? null;
        if (user) {
          db = bearer as any;
        }
      }
    }
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });
    }

    // (Opcional) Verifica que sea profesional
    const { data: pro } = await (db as any)
      .from("professionals")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
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
      const { error } = await (db as any)
        .from("pro_request_favorites")
        .insert({ pro_id: user.id, request_id: requestId });
      // Idempotente: ignorar duplicado
      if (error && (error as any).code !== "23505") {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: JSONH });
      }
      return NextResponse.json({ ok: true, is_favorite: true }, { status: 200, headers: JSONH });
    }

    const { error } = await (db as any)
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
