/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

const BodySchema = z.object({
  content: z.string().max(5000).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const id = params.id;
    let usedDevFallback = false;
    let { user } = (await getDevUserFromHeader(req)) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDevFallback = true;
    const supabase: any = usedDevFallback ? createServiceClient() : await getDbClientForRequest(req);

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });

    // Validate message exists and user is participant (via RLS on update)
    const updates: Record<string, unknown> = {};
    const { content } = parsed.data;
    if (typeof content === "string") updates.body = content;
    if (Object.keys(updates).length === 0)
      return NextResponse.json({ ok: false, error: "NO_CHANGES" }, { status: 400, headers: JSONH });

    const upd = await supabase.from("messages").update(updates).eq("id", id).select("id, body, created_at").single();
    if (upd.error)
      return NextResponse.json({ ok: false, error: upd.error.message }, { status: 400, headers: JSONH });

    return NextResponse.json({ ok: true, data: upd.data }, { status: 200, headers: JSONH });
  } catch (e) {
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    const message = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ ok: false, error: message }, { status, headers: JSONH });
  }
}
