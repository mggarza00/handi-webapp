import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, getUserOrThrow } from "@/lib/_supabase-server";
import { notifyApplicationUpdated } from "@/lib/notifications";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const patchSchema = z.object({
  status: z.enum(["accepted", "rejected", "completed"]),
});

type CtxP = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: CtxP) {
  try {
    const { id } = await params;
    const { supabase, user } = await getUserOrThrow();
    const { status } = patchSchema.parse(await req.json());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("applications")
      .update({ status } as Database["public"]["Tables"]["applications"]["Update"])
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "UPDATE_FAILED", detail: error.message, user_id: user.id }),
        { status: 400, headers: JSONH },
      );
    }
    try {
      await notifyApplicationUpdated({ application_id: data.id, status });
    } catch {
      // no-op
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
