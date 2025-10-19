import { NextResponse } from "next/server";
import { z } from "zod";

import { getDevUserFromHeader, getUserFromRequestOrThrow } from "@/lib/auth-route";
import { createServerClient } from "@/lib/supabase";
import { renderQuotePNG } from "@/lib/quotes/renderImage";
import { buildStorageKey } from "@/lib/storage-sanitize";
import { getSignedUrl, uploadQuoteImage } from "@/lib/storage/quotes";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const ItemSchema = z.object({
  concept: z.string().min(1),
  amount: z.coerce.number().finite().nonnegative(),
});

const BodySchema = z.object({
  conversation_id: z.string().uuid(),
  items: z.array(ItemSchema).min(1),
  currency: z.string().trim().toUpperCase().default("MXN"),
  notes: z.string().trim().optional(),
  folio: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });

    let user = (await getDevUserFromHeader(req))?.user ?? null;
    if (!user) ({ user } = await getUserFromRequestOrThrow(req));
    const admin = createServerClient();

    const body = BodySchema.parse(await req.json());
    const conversationId = body.conversation_id;

    // Validate pro participation
    const { data: conv } = await admin
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });
    if (String(conv.pro_id) !== user.id) return NextResponse.json({ ok: false, error: "ONLY_PRO_CAN_QUOTE" }, { status: 403, headers: JSONH });

    const total = body.items.reduce((acc, it) => acc + Number(it.amount || 0), 0);

    // Insert quote
    const ins = await admin
      .from("quotes")
      .insert({
        conversation_id: conversationId,
        professional_id: user.id,
        client_id: conv.customer_id,
        currency: body.currency || "MXN",
        items: body.items,
        total,
        folio: body.folio || null,
        status: "sent",
      })
      .select("id,currency,total,folio")
      .single();
    if (!ins?.data) {
      const msg = (ins?.error as any)?.message || "QUOTE_CREATE_FAILED";
      return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
    }
    const quoteId: string = ins.data.id;
    const shortId = quoteId.slice(0, 8);
    const folio = (ins.data as any)?.folio as string | null;

    // Load names for rendering
    const [proProfile, clientProfile] = await Promise.all([
      admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
      admin.from("profiles").select("full_name, email").eq("id", conv.customer_id).maybeSingle(),
    ]);

    let png: { buffer: Buffer; contentType: "image/png" } | null = null;
    try {
      png = await renderQuotePNG({
        folio: (folio && folio.trim().length ? folio : shortId),
        dateISO: new Date().toISOString(),
        professional: { name: (proProfile.data as any)?.full_name ?? null, email: (proProfile.data as any)?.email ?? null },
        client: { name: (clientProfile.data as any)?.full_name ?? null, email: (clientProfile.data as any)?.email ?? null },
        currency: body.currency || "MXN",
        items: body.items.map((i) => ({ concept: i.concept, amount: Number(i.amount) })),
        total,
        notes: body.notes && body.notes.length ? body.notes : undefined,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[quotes:image-render-error]', e);
      png = null; // degradar sin imagen
    }

    // Find the chat message created by trigger for this quote (retry small window to avoid race)
    async function resolveMessageId(): Promise<string | null> {
      const maxAttempts = 6; // ~1.2s total
      for (let i = 0; i < maxAttempts; i++) {
        const { data: row } = await admin
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("message_type", "quote")
          .filter("payload->>quote_id", "eq", quoteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const mid = (row as any)?.id as string | undefined;
        if (mid) return mid;
        await new Promise((r) => setTimeout(r, 200));
      }
      return null;
    }
    const messageId = await resolveMessageId();

    // Build key under chat-attachments path convention so participants can read via RLS
    const folioForFile = (folio && folio.trim().length ? folio : shortId).replace(/[^A-Z0-9_-]+/gi, "-");
    const fileName = `cotizacion-${folioForFile}.png`;
    const key = messageId
      ? buildStorageKey(["conversation", conversationId, messageId], fileName)
      : buildStorageKey(["conversation", conversationId, quoteId], fileName);

    // Upload PNG to Storage
    if (png) {
      const up = await uploadQuoteImage(key, png.buffer, png.contentType);
      if (!up.ok) {
        // eslint-disable-next-line no-console
        console.error('[quotes:image-upload-error]', up.error);
        // best-effort cleanup: keep quote without image_path
        return NextResponse.json({ ok: true, id: quoteId, total, image_url: null }, { status: 201, headers: JSONH });
      }
      // Persist image_path and attach to chat message if available
      await admin.from("quotes").update({ image_path: key }).eq("id", quoteId);
      let mid = messageId;
      // Fallback: si el trigger aún no creó el mensaje, créalo explícitamente
      if (!mid) {
        const insMsg = await admin
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            body: "Cotización enviada",
            message_type: "quote",
            payload: {
              quote_id: quoteId,
              items: body.items,
              total,
              currency: body.currency || "MXN",
              image_path: key,
              notes: body.notes && body.notes.length ? body.notes : undefined,
              folio: folio && folio.trim().length ? folio : shortId,
            } as unknown as Record<string, unknown>,
          } as any)
          .select("id")
          .single();
        mid = (insMsg.data as any)?.id as string | undefined ?? null;
      }
      if (mid) {
        await admin.from("message_attachments").insert({
          message_id: mid,
          conversation_id: conversationId,
          uploader_id: user.id,
          storage_path: key,
          filename: fileName,
          mime_type: "image/png",
          byte_size: (png.buffer?.length as number) ?? null,
          width: null,
          height: null,
          sha256: null,
        } as any);
      }
      const signed = await getSignedUrl(key, 600);
      return NextResponse.json({ ok: true, id: quoteId, total, image_url: signed ?? null }, { status: 201, headers: JSONH });
    }
    // Si no se pudo renderizar PNG, continuar sin imagen
    return NextResponse.json({ ok: true, id: quoteId, total, image_url: null }, { status: 201, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
