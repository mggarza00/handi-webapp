import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getDbClientForRequest,
  getUserFromRequestOrThrow,
  getDevUserFromHeader,
} from "@/lib/auth-route";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  schedule_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  schedule_time_start: z.coerce.number().int().min(0).max(23).optional(),
  schedule_time_end: z.coerce.number().int().min(1).max(24).optional(),
  details: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  is_remunerable: z.boolean().optional().default(false),
  deposit_amount: z.coerce.number().positive().default(200),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );

    let usedDevFallback = false;
    let { user } = (await getDevUserFromHeader(req)) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req));
    else usedDevFallback = true;
    const supabase = usedDevFallback
      ? await getDbClientForRequest(req)
      : await getDbClientForRequest(req);
    const admin = createServerClient();

    const conversationId = (params?.id || "").trim();
    if (!conversationId)
      return NextResponse.json(
        { ok: false, error: "MISSING_CONVERSATION" },
        { status: 400, headers: JSONH },
      );

    // Validate user is the pro participant
    const { data: conv } = await (supabase as any)
      .from("conversations")
      .select("id, customer_id, pro_id, request_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv)
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN_OR_NOT_FOUND" },
        { status: 403, headers: JSONH },
      );
    if (String(conv.pro_id) !== user.id)
      return NextResponse.json(
        { ok: false, error: "ONLY_PRO_CAN_REQUEST_ONSITE" },
        { status: 403, headers: JSONH },
      );

    // Prevent incompatible active duplicates in the same conversation.
    const { data: activeRows } = await (admin as any)
      .from("onsite_quote_requests")
      .select(
        "id, status, is_remunerable, remuneration_applied_at, deposit_paid_at, created_at",
      )
      .eq("conversation_id", conversationId)
      .in("status", [
        "requested",
        "scheduled",
        "accepted",
        "deposit_pending",
        "deposit_paid",
      ])
      .order("created_at", { ascending: false })
      .limit(10);
    const active = Array.isArray(activeRows)
      ? (activeRows as Array<{
          id?: string;
          status?: string;
          is_remunerable?: boolean | null;
          remuneration_applied_at?: string | null;
        }>)
      : [];
    if (active.length > 0) {
      const hasPendingOrInProgress = active.some((row) =>
        ["requested", "scheduled", "accepted", "deposit_pending"].includes(
          String(row.status || "").toLowerCase(),
        ),
      );
      if (hasPendingOrInProgress) {
        return NextResponse.json(
          { ok: false, error: "ONSITE_ACTIVE_REQUEST_EXISTS" },
          { status: 409, headers: JSONH },
        );
      }
      const hasEligiblePaid = active.some(
        (row) =>
          String(row.status || "").toLowerCase() === "deposit_paid" &&
          row.is_remunerable === true &&
          !row.remuneration_applied_at,
      );
      if (hasEligiblePaid) {
        return NextResponse.json(
          { ok: false, error: "ONSITE_ELIGIBLE_CREDIT_EXISTS" },
          { status: 409, headers: JSONH },
        );
      }
    }

    const body = BodySchema.parse(await req.json());
    const normalizedDetails = (() => {
      const details =
        typeof body.details === "string" ? body.details.trim() : "";
      if (details.length) return details;
      const notes = typeof body.notes === "string" ? body.notes.trim() : "";
      if (notes.length) return notes;
      return null;
    })();
    const st = body.schedule_time_start ?? null;
    const en = body.schedule_time_end ?? null;
    if (st != null && en != null && !(en > st))
      return NextResponse.json(
        { ok: false, error: "INVALID_SCHEDULE_RANGE" },
        { status: 422, headers: JSONH },
      );

    const ins = await (supabase as any)
      .from("onsite_quote_requests")
      .insert({
        conversation_id: conversationId,
        request_id: conv.request_id || null,
        professional_id: user.id,
        client_id: conv.customer_id,
        status: "deposit_pending",
        schedule_date: body.schedule_date || null,
        schedule_time_start: body.schedule_time_start ?? null,
        schedule_time_end: body.schedule_time_end ?? null,
        details: normalizedDetails,
        notes:
          (typeof body.notes === "string" && body.notes.trim()) ||
          normalizedDetails,
        is_remunerable: body.is_remunerable === true,
        deposit_amount: body.deposit_amount || 200,
      })
      .select("id, status, deposit_amount, is_remunerable, details")
      .single();
    if (!ins?.data) {
      const msg = (ins?.error as any)?.message || "ONSITE_CREATE_FAILED";
      return NextResponse.json(
        { ok: false, error: msg },
        { status: 400, headers: JSONH },
      );
    }

    const createdId = ins.data.id as string;

    // Best-effort notifications to client
    try {
      await (admin as any).from("user_notifications").insert({
        user_id: conv.customer_id,
        type: "onsite_quote",
        title: "Nueva cotización en sitio",
        body: "Recibiste una solicitud de cotización en sitio en el chat.",
        link: `/mensajes/${encodeURIComponent(conversationId)}`,
      });
    } catch {
      /* ignore in-app notification failures */
    }
    try {
      const { notifyChatMessageByConversation } = await import(
        "@/lib/chat-notifier"
      );
      await notifyChatMessageByConversation({
        conversationId,
        senderId: user.id,
        text: "Solicitud de cotización en sitio enviada",
      });
    } catch {
      /* ignore email notification failures */
    }
    try {
      const fnUrlDirect = process.env.SUPABASE_FUNCTIONS_URL;
      const supaUrl =
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const fnBase =
        fnUrlDirect ||
        (supaUrl ? `${supaUrl.replace(/\/$/, "")}/functions/v1` : null);
      const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (fnBase && srk) {
        const fnUrl = `${fnBase.replace(/\/$/, "")}/push-notify`;
        await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Bearer ${srk}`,
          },
          body: JSON.stringify({
            toUserId: conv.customer_id,
            payload: {
              title: "Nueva cotización en sitio",
              body: "Abre el chat para revisar y pagar la visita en sitio.",
              url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ""}/mensajes/${encodeURIComponent(conversationId)}`,
              tag: `onsite:${createdId}`,
              data: {
                type: "onsite_quote_request",
                onsite_request_id: createdId,
                conversation_id: conversationId,
              },
            },
          }),
        }).catch(() => undefined);
      }
    } catch {
      /* ignore push notification failures */
    }

    return NextResponse.json(
      {
        ok: true,
        id: createdId,
        status: (ins.data as any).status ?? "deposit_pending",
        deposit_amount: (ins.data as any).deposit_amount ?? body.deposit_amount,
        is_remunerable: Boolean((ins.data as any).is_remunerable),
        details: (ins.data as any).details ?? normalizedDetails,
      },
      { status: 201, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 400, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
