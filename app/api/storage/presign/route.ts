import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserOrThrow } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const BUCKET = "service-photos";

const BodySchema = z.object({ path: z.string().min(3) });

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getUserOrThrow();
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }
    const path = parsed.data.path.replace(/^\/+/, "");
    // Ensure the user is a professional and fetch professional_id
    const { data: pro } = await supabase
      .from("professionals")
      .select("id")
      .eq("id", user.id)
      .maybeSingle<{ id: string }>();
    if (!pro) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }
    // path must start with <professional_id>/
    if (!path.startsWith(`${pro.id}/`)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_PATH_PREFIX", detail: `El path debe iniciar con ${pro.id}/` },
        { status: 400, headers: JSONH },
      );
    }

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "PRESIGN_FAILED", detail: error.message },
        { status: 400, headers: JSONH },
      );
    }
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json(
      { ok: true, path, url: data?.signedUrl, publicUrl },
      { headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}
