import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";

import type { Database } from "@/types/supabase";

const BodySchema = z.object({
  request_id: z.string().uuid(),
  path: z.string().min(3),
  thumb_path: z.string().min(3).optional().nullable(),
  size_bytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const body = BodySchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.flatten() },
        { status: 400 },
      );
    }

    const { request_id, path, thumb_path, size_bytes, width, height } = body.data;

    const supabase = createRouteHandlerClient<Database>({ cookies });

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user)
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const insertPayload: Database["public"]["Tables"]["request_photos"]["Insert"] = {
      request_id,
      path,
      thumb_path: thumb_path ?? null,
      size_bytes: size_bytes ?? null,
      width: width ?? null,
      height: height ?? null,
    };

    const { data: row, error } = await supabase
      .from("request_photos")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    const expiresIn = 3600;
    const signed: { url?: string; thumbUrl?: string } = {};
    const { data: mainSigned, error: signErr } = await supabase.storage
      .from("requests-photos")
      .createSignedUrl(path, expiresIn);
    if (!signErr) signed.url = mainSigned.signedUrl;

    if (thumb_path) {
      const { data: thumbSigned, error: thumbErr } = await supabase.storage
        .from("requests-photos")
        .createSignedUrl(thumb_path, expiresIn);
      if (!thumbErr) signed.thumbUrl = thumbSigned?.signedUrl;
    }

    return NextResponse.json({ ok: true, data: { row, ...signed, expiresIn } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
