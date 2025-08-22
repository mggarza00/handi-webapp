import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, getUserOrThrow } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const patchSchema = z.object({
  status: z.enum(["accepted", "rejected", "completed"]),
});

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { supabase, user } = await getUserOrThrow();
    const { status } = patchSchema.parse(await req.json());

    const { data, error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "UPDATE_FAILED", detail: error.message, user_id: user.id }),
        { status: 400, headers: JSONH },
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
