import { NextResponse } from "next/server";
import { z } from "zod";

import createClient from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  id: z.string().uuid(),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: JSONH },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload" },
        { status: 422, headers: JSONH },
      );
    }
    const { id } = parsed.data;

    const { data: row } = await supabase
      .from("user_saved_addresses")
      .select("id,times_used")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (!row) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: JSONH },
      );
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("user_saved_addresses")
      .update({
        last_used_at: now,
        times_used: (row.times_used ?? 0) + 1,
      })
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 400, headers: JSONH },
      );
    }

    return NextResponse.json(
      { ok: true, id, last_used_at: now },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}
