import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { ApiError, getUserOrThrow } from "@/lib/_supabase-server";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type CtxP = { params: { id: string } };

export async function GET(_req: Request, { params }: CtxP) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  try {
    await getUserOrThrow(supabase);
  } catch (e) {
    const err = e as ApiError;
    const isAuthErr =
      err?.status === 401 ||
      err?.code === "UNAUTHORIZED" ||
      err?.code === "MISSING_AUTH" ||
      err?.code === "INVALID_TOKEN";
    return new NextResponse(
      JSON.stringify({ ok: false, error: err?.code || "UNAUTHORIZED" }),
      { status: isAuthErr ? 401 : 500, headers: JSONH },
    );
  }

  try {
    const { id } = params;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "NOT_FOUND", detail: error?.message || null }),
        { status: 404, headers: JSONH },
      );
    }
    return NextResponse.json({ ok: true, data }, { status: 200, headers: JSONH });
  } catch {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "INTERNAL_ERROR" }),
      { status: 500, headers: JSONH },
    );
  }
}
