/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";
import { notifyChatMessageByConversation } from "@/lib/chat-notifier";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

const QuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(req: Request, { params }: Ctx) {
  try {
    const id = params.id;
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });
    const { cursor, limit = 50 } = parsed.data;

    let usedDev = false;
    let { user } = await getDevUserFromHeader(req) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDev = true;
    const db: any = usedDev ? createServiceClient() : await getDbClientForRequest(req);

    // Validate membership via conversations
    const conv = await db.from("conversations").select("id, customer_id, pro_id").eq("id", id).maybeSingle();
    if (!conv?.data)
      return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });

    let q = db
      .from("messages")
      .select("id, conversation_id, sender_id, body, text, created_at, read_by")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (cursor) q = q.lt("created_at", cursor);

    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: JSONH });

    const mapped = (data ?? []).map((m: any) => ({
      id: m.id,
      sender_id: m.sender_id,
      body: String((m.body ?? m.text ?? "") as string),
      created_at: m.created_at,
      read_by: Array.isArray(m.read_by) ? (m.read_by as unknown[]).map((x) => String(x)) : [],
    }));
    // Fetch attachments for these messages
    const ids = mapped.map((m: any) => m.id);
    let byMessage: Record<string, unknown[]> = {};
    if (ids.length) {
      const { data: attRows } = await db
        .from("message_attachments")
        .select("id, message_id, filename, mime_type, byte_size, width, height, storage_path, created_at")
        .in("message_id", ids);
      byMessage = (attRows || []).reduce((acc: Record<string, unknown[]>, row: any) => {
        const mid = row.message_id as string;
        (acc[mid] ||= []).push({
          id: row.id,
          filename: row.filename,
          mime_type: row.mime_type,
          byte_size: row.byte_size,
          width: row.width,
          height: row.height,
          storage_path: row.storage_path,
          created_at: row.created_at,
        });
        return acc;
      }, {} as Record<string, unknown[]>);
    }
    const enriched = mapped.map((m: any) => ({ ...m, attachments: byMessage[m.id] || [] }));
    const nextCursor = enriched.length ? enriched[enriched.length - 1].created_at : null;
    return NextResponse.json({ ok: true, data: enriched, nextCursor }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    return NextResponse.json({ ok: false, error: msg }, { status, headers: JSONH });
  }
}

const AttachmentSchema = z.object({
  filename: z.string(),
  mime_type: z.string(),
  byte_size: z.number().int().positive(),
  storage_path: z.string(), // already uploaded path in bucket
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  sha256: z.string().optional(),
});

const BodySchema = z
  .object({
    content: z.string().max(5000).optional(),
    attachments: z.array(AttachmentSchema).max(10).optional().default([]),
  })
  .refine((v) => (v.content && v.content.trim().length > 0) || (Array.isArray(v.attachments) && v.attachments.length > 0), {
    message: "EMPTY_MESSAGE",
    path: ["content"],
  });

function getBasename(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const parts = norm.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : p;
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
    const id = params.id;

    let usedDev = false;
    let { user } = await getDevUserFromHeader(req) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDev = true;
    const db: any = usedDev ? createServiceClient() : await getDbClientForRequest(req);

    // Validate membership
    const conv = await db.from("conversations").select("id").eq("id", id).maybeSingle();
    if (!conv?.data)
      return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });

    const raw = await req.json();
    if (raw && typeof raw === "object" && raw != null && (raw as any).text && !(raw as any).content) {
      (raw as any).content = (raw as any).text;
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });
    const { content = "", attachments = [] } = parsed.data;

    // Size guardrails (must match bucket limits; currently 10MB as per migration)
    const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
    for (const a of attachments) {
      if (a.byte_size > MAX_FILE_BYTES) {
        return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE", detail: { filename: a.filename, limit: MAX_FILE_BYTES } }, { status: 413, headers: JSONH });
      }
    }

    const ins = await db
      .from("messages")
      .insert({ conversation_id: id, sender_id: user.id, body: content || "" })
      .select("id, created_at")
      .single();
    if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400, headers: JSONH });

    const msgId = ins.data.id as string;

    // If attachments present, register metadata rows using provided storage_path (already uploaded)
    if (attachments.length > 0) {
      // Validate that each storage_path targets this conversation
      for (const a of attachments) {
        const norm = a.storage_path.replace(/\\/g, "/");
        if (!norm.startsWith(`conversation/${id}/`)) {
          return NextResponse.json({ ok: false, error: "INVALID_STORAGE_PATH", detail: { storage_path: a.storage_path } }, { status: 400, headers: JSONH });
        }
      }
      const rows = attachments.map((a) => {
        const fileFromPath = getBasename(a.storage_path);
        return {
          message_id: msgId,
          conversation_id: id,
          uploader_id: user.id,
          storage_path: a.storage_path,
          filename: fileFromPath || a.filename,
          mime_type: a.mime_type,
          byte_size: a.byte_size,
          width: a.width ?? null,
          height: a.height ?? null,
          sha256: a.sha256 ?? null,
        };
      });
      const insAtt = await db.from("message_attachments").insert(rows).select("id");
      if (insAtt.error) {
        return NextResponse.json({ ok: false, error: "ATTACHMENTS_CREATE_FAILED", detail: insAtt.error.message }, { status: 400, headers: JSONH });
      }
    }

    await db.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);

    // Fire-and-forget: email al otro participante con el contenido y link al chat
    try {
      const attachLite = (attachments || []).map((a) => ({ filename: a.filename }));
      await notifyChatMessageByConversation({ conversationId: id, senderId: user.id, text: content || "", attachments: attachLite });
    } catch { /* ignore notify errors */ }
    return NextResponse.json({ ok: true, data: ins.data }, { status: 201, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    return NextResponse.json({ ok: false, error: msg }, { status, headers: JSONH });
  }
}
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
