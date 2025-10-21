import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const PatchSchema = z.object({
  status: z
    .enum(["negotiating", "accepted", "paid", "in_process", "completed", "cancelled", "disputed"])
    .optional(),
  amount: z.number().positive().optional(),
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
    const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }
    const updates: Record<string, unknown> = {};
    if (typeof parsed.data.amount === "number") updates.amount = parsed.data.amount;
    if (parsed.data.status) updates.status = parsed.data.status;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "NO_UPDATES" },
        { status: 400, headers: JSONH },
      );
    }
    const supa = createServerClient();
    const up = await supa
      .from("agreements")
      .update(updates)
      .eq("id", parsedId.data)
      .select("*")
      .single();
    if (up.error)
      return NextResponse.json(
        { ok: false, error: up.error.message },
        { status: 400, headers: JSONH },
      );
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
