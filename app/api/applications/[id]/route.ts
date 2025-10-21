import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const PatchSchema = z.object({
  status: z.enum(["accepted", "rejected", "completed"]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const Id = z.string().uuid();
    const parsedId = Id.safeParse(params?.id);
    if (!parsedId.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID" },
        { status: 400, headers: JSONH },
      );
    }
    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }
    const { status } = parsed.data;
    const supa = createServerClient();
    const up = await supa
      .from("applications")
      .update({ status })
      .eq("id", parsedId.data)
      .select("id, status")
      .single();
    if (up.error) {
      return NextResponse.json(
        { ok: false, error: up.error.message },
        { status: 400, headers: JSONH },
      );
    }
    return NextResponse.json({ ok: true, data: up.data }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
