/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

const AttachmentSchema = z.object({
  filename: z.string(),
  // Allow empty string; normalize later. Accept any string to avoid client-specific MIME quirks.
  mime_type: z.string().optional().transform((v) => (v ?? "")),
  // Coerce to number to accept string inputs from some browsers/clients
  byte_size: z.coerce.number().int().positive(),
  storage_path: z.string(),
  // Coerce when present; keep optional for clients that omit
  width: z.coerce.number().int().optional(),
  height: z.coerce.number().int().optional(),
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

    // 1) Fetch conversation_id from message
    const msg = await supabase
      .from("messages")
      .select("id, conversation_id")
      .eq("id", messageId)
      .maybeSingle();
    if (!msg?.data)
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: JSONH });
    const conversationId = msg.data.conversation_id as string;

    // 2) Validate participation (explicit, avoids bypass with SERVICE ROLE in dev)
    const { data: isParticipant, error: rpcErr } = await supabase.rpc(
      "is_conversation_participant",
      { conv_id: conversationId },
    );
    if (rpcErr)
      return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 400, headers: JSONH });
    if (!isParticipant)
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });

    const items = parsed.data.attachments;
    const MAX_FILE_BYTES = 20 * 1024 * 1024;

    const normalizePath = (p: string): string => {
      if (!p) return p;
      // backslash -> slash
      p = p.split(String.fromCharCode(92)).join("/");
      // quita prefijo del bucket si viene
      if (p.startsWith("message-attachments/")) p = p.slice("message-attachments/".length);
      return p;
    };

    type Row = {
      message_id: string;
      conversation_id: string;
      uploader_id: string;
      storage_path: string;
      filename: string;
      mime_type: string;
      byte_size: number;
      width: number | null;
      height: number | null;
      sha256: string | null;
    };

    const rows: Row[] = [];
    for (const a of items) {
      // Normalize path and gently repair legacy shapes
      const rawNorm = normalizePath(a.storage_path || "").trim();
      // strip any leading slashes for uniformity
      let normPath = rawNorm.replace(/^\/+/, "");

      // Accept normal: conversation/<conv>/<msg>/<file>
      if (!normPath.startsWith(`conversation/${conversationId}/`)) {
        // Fallback: if path contains the messageId segment, rebuild canonical path
        const parts = normPath.split("/").filter(Boolean);
        const hasMsgId = parts.includes(messageId);
        const filenameFromPath = parts.length ? parts[parts.length - 1] : "";
        if (hasMsgId && filenameFromPath) {
          normPath = `conversation/${conversationId}/${messageId}/${filenameFromPath}`;
        } else {
          // As a last resort, if we have a provided filename, build canonical path
          const safeFilename = (a.filename || filenameFromPath || "").split("/").pop() || "";
          if (safeFilename) {
            normPath = `conversation/${conversationId}/${messageId}/${safeFilename}`;
          } else {
            return NextResponse.json(
              { ok: false, error: "INVALID_STORAGE_PATH", detail: a.storage_path },
              { status: 400, headers: JSONH },
            );
          }
        }
      }
      const size = Number(a.byte_size);
      if (!Number.isFinite(size) || size > MAX_FILE_BYTES)
        return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE", detail: { filename: a.filename, limit: MAX_FILE_BYTES } }, { status: 413, headers: JSONH });

      // Normalize mime: allow image/*, application/pdf, and accept empty or octet-stream
      const ext = (a.filename || "").toLowerCase().split(".").pop() || "";
      let mime = (a.mime_type || "").trim();
      if (!mime) mime = "application/octet-stream";
      // If file looks like a PDF, force correct MIME for consistency
      if ((mime === "application/octet-stream" || mime === "" || mime === undefined) && ext === "pdf") mime = "application/pdf";
      if (mime === "application/x-pdf") mime = "application/pdf";
      // Enforce minimal allowlist: images, PDF, or octet-stream
      const allowed = mime === "application/pdf" || mime === "application/octet-stream" || mime.startsWith("image/");
      if (!allowed) {
        return NextResponse.json(
          { ok: false, error: "INVALID_MIME_TYPE", detail: { filename: a.filename, mime_type: a.mime_type } },
          { status: 422, headers: JSONH },
        );
      }

      rows.push({
        message_id: messageId,
        conversation_id: conversationId,
        uploader_id: user.id,
        storage_path: normPath,
        filename: a.filename || normPath.split("/").filter(Boolean).pop() || "",
        mime_type: mime,
        byte_size: size,
        width: typeof a.width === "number" && Number.isFinite(a.width) ? a.width : null,
        height: typeof a.height === "number" && Number.isFinite(a.height) ? a.height : null,
        sha256: a.sha256 ?? null,
      });
    }

    // 3) Insert with correct conversation_id
    const ins = await supabase
      .from("message_attachments")
      .insert(rows)
      .select("id, storage_path, filename, mime_type, byte_size, width, height");
    if (ins.error)
      return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400, headers: JSONH });

    return NextResponse.json({ ok: true, attachments: ins.data ?? [] }, { status: 200, headers: JSONH });
  } catch (e) {
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    const message = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ ok: false, error: message }, { status, headers: JSONH });
  }
}
