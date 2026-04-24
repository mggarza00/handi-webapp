import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getDbClientForRequest,
  getUserFromRequestOrThrow,
  getDevUserFromHeader,
} from "@/lib/auth-route";
import { findOnsiteRequestBlocker } from "@/lib/onsite/request-blockers";
import { resolveParticipantProfileIds } from "@/lib/onsite/participant-profile-ids";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  schedule_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  schedule_time_start: z.coerce.number().int().min(0).max(23).optional(),
  schedule_time_end: z.coerce.number().int().min(1).max(24).optional(),
  details: z.string().max(1000).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  is_remunerable: z.boolean().optional().default(false),
  deposit_amount: z.coerce.number().positive().default(200),
});

function errorResponse(
  status: number,
  error: string,
  detail?: string | null,
  code?: string | null,
  debug?: Record<string, unknown> | null,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(detail ? { detail } : {}),
      ...(code ? { code } : {}),
      ...(process.env.NODE_ENV !== "production" && debug ? { debug } : {}),
    },
    { status, headers: JSONH },
  );
}

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
    const conversationId = (params?.id || "").trim();
    const rawBody = await req.json();
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[onsite-quote-request] received body", {
        conversationId,
        body: rawBody,
      });
    }

    let usedDevFallback = false;
    let { user } = (await getDevUserFromHeader(req)) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req));
    else usedDevFallback = true;
    const supabase = usedDevFallback
      ? await getDbClientForRequest(req)
      : await getDbClientForRequest(req);
    const admin = createServerClient();

    if (!conversationId) return errorResponse(400, "MISSING_CONVERSATION");

    // Validate user is the pro participant
    const { data: conv } = await (supabase as any)
      .from("conversations")
      .select("id, customer_id, pro_id, request_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return errorResponse(403, "FORBIDDEN_OR_NOT_FOUND");
    if (String(conv.pro_id) !== user.id)
      return errorResponse(403, "ONLY_PRO_CAN_REQUEST_ONSITE");

    const participantProfiles = await resolveParticipantProfileIds(admin, {
      professionalAuthUserId: user.id,
      clientAuthUserId:
        typeof conv.customer_id === "string" ? conv.customer_id : null,
    });
    if (!participantProfiles.professionalProfileId) {
      return errorResponse(
        409,
        "ONSITE_PROFESSIONAL_PROFILE_MISSING",
        "No profile row was found for the professional conversation participant.",
      );
    }
    if (!participantProfiles.clientProfileId) {
      return errorResponse(
        409,
        "ONSITE_CLIENT_PROFILE_MISSING",
        "No profile row was found for the client conversation participant.",
      );
    }

    // Prevent incompatible active duplicates in the same conversation.
    const { data: activeRows } = await (admin as any)
      .from("onsite_quote_requests")
      .select(
        "id, conversation_id, request_id, status, is_remunerable, remuneration_applied_at, deposit_paid_at, created_at, updated_at",
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
          conversation_id?: string;
          request_id?: string | null;
          status?: string;
          is_remunerable?: boolean | null;
          remuneration_applied_at?: string | null;
          deposit_paid_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        }>)
      : [];
    const blocker = findOnsiteRequestBlocker(active);
    if (blocker) {
      return errorResponse(
        409,
        blocker.code,
        `Blocked by onsite_quote_requests.${blocker.blocker.id || "unknown"} with status ${blocker.blocker.status || "unknown"}.`,
        null,
        {
          blocker_code: blocker.code,
          blocker: blocker.blocker,
          conversation_id: conversationId,
          request_id:
            typeof conv.request_id === "string" ? conv.request_id : null,
          filter: {
            by: "conversation_id",
            statuses: [
              "requested",
              "scheduled",
              "accepted",
              "deposit_pending",
              "deposit_paid",
            ],
          },
        },
      );
    }

    const parsedBody = BodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("[onsite-quote-request] validation failed", {
          conversationId,
          issues: parsedBody.error.issues,
          body: rawBody,
        });
      }
      return errorResponse(
        422,
        "ONSITE_QUOTE_REQUEST_VALIDATION_FAILED",
        JSON.stringify(parsedBody.error.flatten()),
      );
    }
    const body = parsedBody.data;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[onsite-quote-request] parsed body", {
        conversationId,
        body,
      });
    }
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
      return errorResponse(422, "INVALID_SCHEDULE_RANGE");

    const ins = await (supabase as any)
      .from("onsite_quote_requests")
      .insert({
        conversation_id: conversationId,
        request_id: conv.request_id || null,
        professional_id: participantProfiles.professionalProfileId,
        client_id: participantProfiles.clientProfileId,
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
    if (ins?.error || !ins?.data) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[onsite-quote-request] insert failed", {
          conversationId,
          code: (ins?.error as { code?: string } | null)?.code || null,
          message: (ins?.error as { message?: string } | null)?.message || null,
          details: (ins?.error as { details?: string } | null)?.details || null,
          hint: (ins?.error as { hint?: string } | null)?.hint || null,
          body,
        });
      }
      return errorResponse(
        500,
        "ONSITE_QUOTE_REQUEST_INSERT_FAILED",
        [
          (ins?.error as { message?: string } | null)?.message || null,
          (ins?.error as { details?: string } | null)?.details || null,
          (ins?.error as { hint?: string } | null)?.hint || null,
        ]
          .filter(Boolean)
          .join(" | "),
        (ins?.error as { code?: string } | null)?.code || null,
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
      const { notifyChatMessageByConversation } =
        await import("@/lib/chat-notifier");
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
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[onsite-quote-request] unexpected error", e);
    }
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return errorResponse(400, msg);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
