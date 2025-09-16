import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";

import type { Database } from "@/types/supabase";
import { notifyAgreementCreated } from "@/lib/notifications";

const BodySchema = z.object({
  request_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  amount: z.number().positive().optional(),
});

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request) {
  try {
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

    const supabase = createRouteHandlerClient<Database>({ cookies });
    // Tipado de Supabase puede no inferir correctamente en esta ruta; relajamos solo la llamada.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("agreements")
      .insert({
        request_id: parsed.data.request_id,
        professional_id: parsed.data.professional_id,
        amount: parsed.data.amount ?? null,
      } as Database["public"]["Tables"]["agreements"]["Insert"])
      .select("id, status, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", detail: error.message },
        { status: 500, headers: JSONH },
      );
    }

    try {
      await notifyAgreementCreated({
        request_id: parsed.data.request_id,
        professional_id: parsed.data.professional_id,
        agreement_id: data.id,
      });
    } catch {
      // no-op
    }
    return NextResponse.json(
      { ok: true, data },
      { status: 201, headers: JSONH },
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
