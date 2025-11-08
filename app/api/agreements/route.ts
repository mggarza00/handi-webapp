import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  request_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  amount: z.number().positive().optional(),
  status: z
    .enum(["negotiating", "accepted", "paid", "in_progress", "completed", "cancelled", "disputed"])
    .optional(),
});

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }
    const { request_id, professional_id, amount, status } = parsed.data;
    const supa = createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = supa as any;
    const ins = await q
      .from("agreements")
      .insert([
        {
          request_id,
          professional_id,
          ...(typeof amount === "number" ? { amount } : {}),
          ...(status ? { status } : { status: "accepted" }),
        },
      ])
      .select("*")
      .single();
    if (ins.error)
      return NextResponse.json(
        { ok: false, error: ins.error.message },
        { status: 400, headers: JSONH },
      );
    return NextResponse.json({ ok: true, data: ins.data }, { status: 201, headers: JSONH });
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
