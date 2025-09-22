import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";

import type { Database } from "@/types/supabase";
import { notifyAgreementUpdated } from "@/lib/notifications";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const StatusEnum = z.enum([
  "accepted",
  "paid",
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
]);

const PatchSchema = z
  .object({
    status: StatusEnum.optional(),
    amount: z.number().positive().optional(),
  })
  .refine((d) => d.status || d.amount !== undefined, {
    message: "At least one of {status, amount} is required",
  });

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const idParse = z.string().uuid().safeParse(id);
    if (!idParse.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID" },
        { status: 400, headers: JSONH },
      );
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "CONTENT_TYPE_MUST_BE_JSON" },
        { status: 415, headers: JSONH },
      );
    }

    const json = await req.json();
    const parse = PatchSchema.safeParse(json);
    if (!parse.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parse.error.issues },
        { status: 400, headers: JSONH },
      );
    }

    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );
    }

    const update: Database["public"]["Tables"]["agreements"]["Update"] =
      {} as Database["public"]["Tables"]["agreements"]["Update"];
    if (parse.data.status) update.status = parse.data.status;
    if (parse.data.amount !== undefined) update.amount = parse.data.amount;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("agreements")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "UPDATE_FAILED", detail: error.message },
        { status: 400, headers: JSONH },
      );
    }
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    try {
      if (parse.data.status) {
        await notifyAgreementUpdated({
          agreement_id: data.id,
          status: parse.data.status,
        });
      }
    } catch {
      // no-op
    }
    return NextResponse.json(
      { ok: true, agreement: data },
      { status: 200, headers: JSONH },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500, headers: JSONH },
    );
  }
}
