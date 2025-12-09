import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";

import { getUserOrThrow } from "@/lib/_supabase-server";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

const BodySchema = z
  .object({
    urls: z.array(z.string().url()).min(1).max(10).optional(),
    keys: z.array(z.string().min(3)).min(1).max(10).optional(),
  })
  .refine((v) => Boolean(v.urls?.length || v.keys?.length), {
    message: "Debe proveer 'urls' o 'keys'",
    path: ["urls"],
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
    let urls = parsed.data.urls ?? [];
    const keys = parsed.data.keys ?? [];
    if (keys.length) {
      // Map keys to public URLs in service-photos bucket
      const pub = (k: string) => supabase.storage.from("service-photos").getPublicUrl(k).data.publicUrl;
      urls = urls.concat(keys.map(pub));
    }

    // Verificar que el usuario es el profesional asignado a la solicitud y estado válido
    type AgreementLite = { id: string; request_id: string; professional_id: string; status: string | null };
    const { data: ag, error: agErr } = await supabase
      .from("agreements")
      .select("id, request_id, professional_id, status")
      .eq("request_id", requestId)
      .eq("professional_id", user.id)
      .maybeSingle<AgreementLite>();
    if (agErr || !ag) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }
    // Estado de la solicitud
    const { data: reqRow } = await supabase
      .from("requests")
      .select("id, status")
      .eq("id", requestId)
      .maybeSingle<{ id: string; status: string | null }>();
    const status = reqRow?.status ?? null;
    if (!(status === "completed" || status === "in_review" || status === "in_process")) {
      return NextResponse.json(
        { ok: false, error: "INVALID_STATUS" },
        { status: 400, headers: JSONH },
      );
    }

    const rows: Database["public"]["Tables"]["service_photos"]["Insert"][] = urls.map((u) => ({
      offer_id: ag!.id,
      request_id: requestId,
      professional_id: user.id,
      image_url: u,
    }));
    const { error: insErr } = await supabase
      .from("service_photos")
      .insert(rows as unknown as never);
    if (insErr) {
      return NextResponse.json(
        { ok: false, error: "INSERT_FAILED", detail: insErr.message },
        { status: 400, headers: JSONH },
      );
    }

    try { revalidateTag(`profile:${user.id}`); } catch (_e) { void _e; }
    return NextResponse.json({ ok: true, count: rows.length }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}
