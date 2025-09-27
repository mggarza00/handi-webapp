/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const AttachmentSchema = z.object({
  filename: z.string(),
  mime_type: z.string(),
  byte_size: z.number().int().positive(),
  storage_path: z.string(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  sha256: z.string().optional(),
});

const BodySchema = z
  .object({
    conversationId: z.string().uuid(),
    body: z.string().max(4000).optional(),
    attachments: z.array(AttachmentSchema).optional().default([]),
  })
  .refine((v) => (v.body && v.body.trim().length > 0) || (Array.isArray(v.attachments) && v.attachments.length > 0), {
    message: "EMPTY_MESSAGE",
    path: ["body"],
  });

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );

    let usedDevFallback = false;
    let { user } = await getDevUserFromHeader(req) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDevFallback = true;
    const supabase = usedDevFallback ? (createServiceClient() as any) : await getDbClientForRequest(req);
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    const { conversationId, body = "", attachments = [] } = parsed.data;

    // Validar participación con Service Role (comprobación explícita de pertenencia)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conv = await (supabase as any)
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv.data)
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN_OR_NOT_FOUND" },
        { status: 403, headers: JSONH },
      );

    // Insertar mensaje (RLS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = await (supabase as any)
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, body: body || "" })
      .select("id, created_at")
      .single();
    if (ins.error)
      return NextResponse.json(
        { ok: false, error: "MESSAGE_CREATE_FAILED", detail: ins.error.message },
        { status: 400, headers: JSONH },
      );

    // Registrar adjuntos si vienen en el payload (ruta ya subida al bucket)
    if (attachments.length > 0) {
      // Valida que los paths pertenezcan a la conversación
      for (const a of attachments) {
        const norm = a.storage_path.replace(/\\/g, "/");
        if (!norm.startsWith(`conversation/${conversationId}/`)) {
          return NextResponse.json(
            { ok: false, error: "INVALID_STORAGE_PATH", detail: { storage_path: a.storage_path } },
            { status: 400, headers: JSONH },
          );
        }
      }
      // Tamaño máximo por archivo: 20MB
      const MAX_FILE_BYTES = 20 * 1024 * 1024;
      for (const a of attachments) {
        if (a.byte_size > MAX_FILE_BYTES) {
          return NextResponse.json(
            { ok: false, error: "FILE_TOO_LARGE", detail: { filename: a.filename, limit: MAX_FILE_BYTES } },
            { status: 413, headers: JSONH },
          );
        }
      }
      const rows = attachments.map((a) => {
        const norm = a.storage_path.replace(/\\/g, "/");
        const parts = norm.split("/").filter(Boolean);
        const filename = parts.length ? parts[parts.length - 1] : a.filename;
        return {
          message_id: ins.data.id,
          conversation_id: conversationId,
          uploader_id: user.id,
          storage_path: a.storage_path,
          filename,
          mime_type: a.mime_type,
          byte_size: a.byte_size,
          width: a.width ?? null,
          height: a.height ?? null,
          sha256: a.sha256 ?? null,
        };
      });
      const insAtt = await (supabase as any).from("message_attachments").insert(rows).select("id");
      if (insAtt.error)
        return NextResponse.json(
          { ok: false, error: "ATTACHMENTS_CREATE_FAILED", detail: insAtt.error.message },
          { status: 400, headers: JSONH },
        );
    }

    // Actualizar last_message_at (RLS permite a participantes)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json(
      { ok: true, data: ins.data },
      { status: 201, headers: JSONH },
    );
  } catch (e) {
    const anyE = e as unknown as { status?: number; code?: string; message?: string; stack?: string };
    const msg = anyE?.code || (e instanceof Error ? e.message : "INTERNAL_ERROR");
    const isAuthErr = msg === "UNAUTHORIZED" || msg === "MISSING_AUTH" || msg === "INVALID_TOKEN";
    const status = typeof anyE?.status === "number" ? anyE.status : isAuthErr ? 401 : 500;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("/api/chat/send error:", e);
    }
    return NextResponse.json(
      { ok: false, error: msg, detail: process.env.NODE_ENV !== "production" ? anyE?.stack || null : undefined },
      { status, headers: JSONH },
    );
  }
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
