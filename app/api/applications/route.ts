import { NextResponse } from "next/server";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";

import { ApiError, getUserOrThrow } from "@/lib/_supabase-server";
import { notifyApplicationCreated } from "@/lib/notifications";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const createSchema = z.object({
  request_id: z.string().uuid(),
  note: z.string().max(2000).optional().nullable(),
});

export async function GET() {
  try {
    const { supabase, user } = await getUserOrThrow();

    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("professional_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "LIST_FAILED", detail: error.message }),
        { status: 500, headers: JSONH },
      );
    }

    return NextResponse.json({ ok: true, data }, { headers: JSONH });
  } catch (e) {
    const err = e as ApiError;
    const status = err?.status ?? 401;
    return new NextResponse(JSON.stringify({ ok: false, error: err?.code ?? "UNAUTHORIZED" }), {
      status,
      headers: JSONH,
    });
  }
}

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return new NextResponse(JSON.stringify({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }), {
        status: 415,
        headers: JSONH,
      });
    }

    const { supabase, user } = await getUserOrThrow();
    const body = createSchema.parse(await req.json());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("applications")
      .insert({
        request_id: body.request_id,
        professional_id: user.id,
        note: body.note ?? null,
      } as Database["public"]["Tables"]["applications"]["Insert"])
      .select()
      .single();

    if (error) {
      const pgErr = error as PostgrestError;
      const code = pgErr.code === "23505" ? "ALREADY_APPLIED" : "CREATE_FAILED";
      return new NextResponse(JSON.stringify({ ok: false, error: code, detail: pgErr.message }), {
        status: 400,
        headers: JSONH,
      });
    }

    try {
      await notifyApplicationCreated({ request_id: data.request_id, professional_id: user.id });
    } catch {
      // no-op
    }
    return NextResponse.json({ ok: true, data }, { status: 201, headers: JSONH });
  } catch (e) {
    const err = e as ApiError;
    const status = err?.status ?? 401;
    return new NextResponse(JSON.stringify({ ok: false, error: err?.code ?? "UNAUTHORIZED" }), {
      status,
      headers: JSONH,
    });
  }
}
