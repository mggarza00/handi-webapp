import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";

import type { Database } from "@/types/supabase";

const IdParam = z.string().uuid();
const BodySchema = z.object({ role: z.enum(["client", "pro"]) });

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );
    }

    const { id: rid } = params;
    const id = IdParam.safeParse(rid);
    if (!id.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID" },
        { status: 400, headers: JSONH },
      );
    }

    if (me !== id.data) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }

    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "VALIDATION_ERROR",
          detail: parsed.error.issues.map((i) => i.message),
        },
        { status: 400, headers: JSONH },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("profiles")
      .update({
        role: parsed.data.role,
      } as Database["public"]["Tables"]["profiles"]["Update"])
      .eq("id", id.data)
      .select("id, role")
      .single();

    if (error) {
      const status = /permission|rls/i.test(error.message) ? 403 : 400;
      return NextResponse.json(
        { ok: false, error: "UPDATE_FAILED", detail: error.message },
        { status, headers: JSONH },
      );
    }

    return NextResponse.json(
      { ok: true, data },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status, headers: JSONH },
    );
  }
}
