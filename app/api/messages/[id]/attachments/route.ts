/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

const AttachmentSchema = z.object({
  filename: z.string(),
  mime_type: z.string(),
  byte_size: z.number().int().positive(),
  storage_path: z.string(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  sha256: z.string().optional(),
});

const BodySchema = z.object({ attachments: z.array(AttachmentSchema).max(20) });

export async function POST(req: Request, { params }: Ctx) {
  try {
    const messageId = params.id;
    let usedDevFallback = false;
    let { user } = (await getDevUserFromHeader(req)) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDevFallback = true;
    const supabase: any = usedDevFallback ? createServiceClient() : await getDbClientForRequest(req);

    // Fetch message to validate conversation and membership
    const msg = await supabase.from("messages").select("id, conversation_id").eq("id", messageId).maybeSingle();
    if (!msg?.data)
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: JSONH });
    const conversationId = msg.data.conversation_id as string;

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });

    const items = parsed.data.attachments;
    // Validate storage_path prefix and size
    const MAX_FILE_BYTES = 20 * 1024 * 1024;
    for (const a of items) {
      const norm = a.storage_path.replace(/\\/g, "/");
      if (!norm.startsWith(`conversation/${conversationId}/`))
        return NextResponse.json({ ok: false, error: "INVALID_STORAGE_PATH", detail: a.storage_path }, { status: 400, headers: JSONH });
      if (a.byte_size > MAX_FILE_BYTES)
        return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE", detail: { filename: a.filename, limit: MAX_FILE_BYTES } }, { status: 413, headers: JSONH });
    }

    const rows = items.map((a) => ({
      message_id: messageId,
      conversation_id: conversationId,
      uploader_id: user.id,
      storage_path: a.storage_path,
      filename: a.filename,
      mime_type: a.mime_type,
      byte_size: a.byte_size,
      width: a.width ?? null,
      height: a.height ?? null,
      sha256: a.sha256 ?? null,
    }));
    const ins = await supabase.from("message_attachments").insert(rows).select("id");
    if (ins.error)
      return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400, headers: JSONH });

    return NextResponse.json({ ok: true }, { status: 201, headers: JSONH });
  } catch (e) {
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    const message = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ ok: false, error: message }, { status, headers: JSONH });
  }
}

