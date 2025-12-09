import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const Id = z.string().uuid();
    const parsed = Id.safeParse(params?.id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_ID" },
        { status: 400, headers: JSONH },
      );
    }
    const requestId = parsed.data;
    const supa = createServerClient();
    const { data, error } = await supa
      .from("agreements")
      .select("*")
      .eq("request_id", requestId)
      .order("updated_at", { ascending: false, nullsFirst: false });
    if (error)
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: JSONH },
      );
    return NextResponse.json({ ok: true, data: data ?? [] }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
