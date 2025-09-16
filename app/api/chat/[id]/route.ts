/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const id = (await params).id;
    const IdSchema = z.string().uuid();
    if (!IdSchema.safeParse(id).success)
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 422, headers: JSONH });

    let usedDev = false;
    let { user } = (await getDevUserFromHeader(req)) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDev = true;
    const db: any = usedDev ? createServiceClient() : await getDbClientForRequest(req);

    // Validate membership with RLS-respecting client when possible
    const conv = await db
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", id)
      .maybeSingle();
    if (!conv?.data)
      return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });

    // Perform delete with service client to bypass missing RLS delete policy
    const svc = createServiceClient();
    const del = await svc.from("conversations").delete().eq("id", id);
    if (del.error)
      return NextResponse.json({ ok: false, error: del.error.message }, { status: 400, headers: JSONH });

    return NextResponse.json({ ok: true }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    return NextResponse.json({ ok: false, error: msg }, { status, headers: JSONH });
  }
}

