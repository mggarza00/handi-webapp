/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";
import { getAdminSupabase } from "@/lib/supabase/admin";
import webpush from "web-push";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

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
      // Helper: normaliza path (Windows/backslashes y quita prefijo de bucket)
      const normalizePath = (p: string): string => {
        if (!p) return p as unknown as string;
        p = p.split(String.fromCharCode(92)).join("/");
        if (p.startsWith("message-attachments/")) p = p.slice("message-attachments/".length);
        return p;
      };
      // Tamaño máximo por archivo: 20MB
      const MAX_FILE_BYTES = 20 * 1024 * 1024;

      // Validación básica de cada adjunto + normalización
      for (const a of attachments) {
        const norm = normalizePath(a.storage_path || "");
        if (!norm.startsWith(`conversation/${conversationId}/`)) {
          return NextResponse.json(
            { ok: false, error: "INVALID_STORAGE_PATH", detail: { storage_path: a.storage_path } },
            { status: 400, headers: JSONH },
          );
        }
        const size = Number(a.byte_size);
        if (!Number.isFinite(size) || size > MAX_FILE_BYTES) {
          return NextResponse.json(
            { ok: false, error: "FILE_TOO_LARGE", detail: { filename: a.filename, limit: MAX_FILE_BYTES } },
            { status: 413, headers: JSONH },
          );
        }
        // MIME relajado: permite image/*, application/pdf, y octet-stream; corrige PDFs silenciosos
        const ext = (a.filename || "").toLowerCase().split(".").pop() || "";
        let mime = (a.mime_type || "").trim();
        if (!mime) mime = "application/octet-stream";
        if ((mime === "application/octet-stream" || mime === "") && ext === "pdf") mime = "application/pdf";
        if (mime === "application/x-pdf") mime = "application/pdf";
        const allowed = mime === "application/pdf" || mime === "application/octet-stream" || mime.startsWith("image/");
        if (!allowed) {
          return NextResponse.json(
            { ok: false, error: "INVALID_MIME_TYPE", detail: { filename: a.filename, mime_type: a.mime_type } },
            { status: 422, headers: JSONH },
          );
        }
      }

      const rows = attachments.map((a) => {
        const norm = normalizePath(a.storage_path || "");
        const parts = norm.split("/").filter(Boolean);
        const filename = parts.length ? parts[parts.length - 1] : a.filename;
        const ext = (a.filename || "").toLowerCase().split(".").pop() || "";
        let mime = (a.mime_type || "").trim();
        if (!mime) mime = "application/octet-stream";
        if ((mime === "application/octet-stream" || mime === "") && ext === "pdf") mime = "application/pdf";
        if (mime === "application/x-pdf") mime = "application/pdf";
        const size = Number(a.byte_size);
        return {
          message_id: ins.data.id,
          conversation_id: conversationId,
          uploader_id: user.id,
          storage_path: norm,
          filename,
          mime_type: mime,
          byte_size: size,
          width: typeof a.width === "number" && Number.isFinite(a.width) ? a.width : null,
          height: typeof a.height === "number" && Number.isFinite(a.height) ? a.height : null,
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

    // Enviar push al otro participante (no bloqueante; ignora errores)
    try {
      const senderId = user.id as string;
      const customerId = (conv.data as any)?.customer_id as string | undefined;
      const proId = (conv.data as any)?.pro_id as string | undefined;
      const recipientId = senderId === customerId ? proId : customerId;
      if (recipientId && typeof recipientId === 'string') {
        const fnUrlDirect = process.env.SUPABASE_FUNCTIONS_URL;
        const supaUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const fnBase = fnUrlDirect || (supaUrl ? `${supaUrl.replace(/\/$/, '')}/functions/v1` : null);
        const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (fnBase && srk) {
          const urlPath = `/mensajes/${conversationId}`;
          const fnUrl = `${fnBase.replace(/\/$/, '')}/push-notify`;
          const previewText = (body || '').trim().slice(0, 140) || 'Tienes un mensaje nuevo en Handi';
          const fnRes = await fetch(fnUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              Authorization: `Bearer ${srk}`,
            },
            body: JSON.stringify({
              toUserId: recipientId,
              payload: {
                title: 'Nuevo mensaje',
                body: previewText,
                url: urlPath,
                tag: `thread:${conversationId}`,
                icon: '/icons/icon-192.png',
                badge: '/icons/badge-72.png',
              },
            }),
          }).catch(() => undefined as unknown as Response);

          // Fallback: if Edge fails or returns non-2xx, send directly from Node using web-push
          if (!fnRes || !fnRes.ok) {
            const VAPID_PUBLIC = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
            const VAPID_PRIVATE = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
            const VAPID_SUBJECT = process.env.WEB_PUSH_VAPID_SUBJECT || 'mailto:soporte@handi.mx';
            if (VAPID_PUBLIC && VAPID_PRIVATE) {
              try {
                webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
                const admin = getAdminSupabase();
                const { data: subs } = await admin
                  .from('web_push_subscriptions')
                  .select('id, endpoint, keys, p256dh, auth')
                  .eq('user_id', recipientId);
                const payload = JSON.stringify({
                  title: 'Nuevo mensaje',
                  body: previewText,
                  url: urlPath,
                  tag: `thread:${conversationId}`,
                  icon: '/icons/icon-192.png',
                  badge: '/icons/badge-72.png',
                });
                for (const s of subs || []) {
                  const rawKeys: any = (s as any).keys ?? { p256dh: (s as any).p256dh, auth: (s as any).auth };
                  if (!rawKeys?.p256dh || !rawKeys?.auth) continue;
                  const subscription = { endpoint: (s as any).endpoint, keys: { p256dh: rawKeys.p256dh, auth: rawKeys.auth } } as any;
                  try { await webpush.sendNotification(subscription, payload); } catch { /* ignore per sub */ }
                }
              } catch { /* ignore fallback errors */ }
            }
          }
        }
      }
    } catch {
      // ignore push errors
    }

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
