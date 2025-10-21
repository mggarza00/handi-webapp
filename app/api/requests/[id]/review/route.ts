import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";

import { getUserOrThrow } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

const BodySchema = z.object({
  professional_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { supabase, user } = await getUserOrThrow();
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }
    const requestId = params.id;
    const { professional_id, rating, comment } = parsed.data;

    // Verificar que el usuario es el cliente creador y que la solicitud está completada
    type RequestLite = { id: string; created_by: string; status: string | null };
    const { data: reqRow, error: reqErr } = await supabase
      .from("requests")
      .select("id, created_by, status")
      .eq("id", requestId)
      .maybeSingle<RequestLite>();
    if (reqErr || !reqRow || reqRow.created_by !== user.id) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }
    if (reqRow.status !== "completed") {
      return NextResponse.json(
        { ok: false, error: "REQUEST_NOT_COMPLETED" },
        { status: 400, headers: JSONH },
      );
    }

    // Verificar que profesional esté vinculado por agreements
    const { data: ag, error: agErr } = await supabase
      .from("agreements")
      .select("id")
      .eq("request_id", requestId)
      .eq("professional_id", professional_id)
      .maybeSingle();
    if (agErr || !ag) {
      return NextResponse.json(
        { ok: false, error: "PROFESSIONAL_NOT_IN_REQUEST" },
        { status: 403, headers: JSONH },
      );
    }

    // Insertar en la vista reviews (redirige a ratings via trigger)
    const { error: insErr } = await supabase
      .from("reviews")
      .insert(([
        {
          request_id: requestId,
          client_id: user.id,
          professional_id,
          rating,
          comment: comment?.trim() ? comment.trim() : null,
        },
      ] as unknown) as never);
    if (insErr) {
      const code = /duplicate|unique/i.test(insErr.message) ? 409 : 500;
      return NextResponse.json(
        { ok: false, error: "INSERT_FAILED", detail: insErr.message },
        { status: code, headers: JSONH },
      );
    }

    // Invalida caché de página pública del profesional
    try { revalidateTag(`profile:${professional_id}`); } catch (_e) { void _e; }
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}
