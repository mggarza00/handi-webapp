import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getDevUserFromHeader,
  getUserFromRequestOrThrow,
} from "@/lib/auth-route";
import { resolveParticipantProfileIds } from "@/lib/onsite/participant-profile-ids";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  conversation_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_start: z.coerce.number().int().min(0).max(23),
  time_end: z.coerce.number().int().min(1).max(24),
  notes: z.string().max(1000).optional(),
});

function errorResponse(
  status: number,
  error: string,
  detail?: string | null,
  code?: string | null,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(detail ? { detail } : {}),
      ...(code ? { code } : {}),
    },
    { status, headers: JSONH },
  );
}

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );
    let user = (await getDevUserFromHeader(req))?.user ?? null;
    if (!user) ({ user } = await getUserFromRequestOrThrow(req));
    const admin = createServerClient();
    const body = BodySchema.parse(await req.json());
    const { conversation_id, date, time_start, time_end, notes } = body;
    if (!(time_end > time_start))
      return errorResponse(422, "INVALID_SCHEDULE_RANGE");

    // Validate client participation
    const { data: conv } = await admin
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", conversation_id)
      .maybeSingle();
    const convRow = conv as unknown as {
      customer_id?: string;
      pro_id?: string;
    } | null;
    if (!convRow) return errorResponse(403, "FORBIDDEN_OR_NOT_FOUND");
    if (String(convRow.customer_id) !== user.id)
      return errorResponse(403, "ONLY_CLIENT_CAN_SCHEDULE");

    const participantProfiles = await resolveParticipantProfileIds(admin, {
      professionalAuthUserId: convRow.pro_id ?? null,
      clientAuthUserId: convRow.customer_id ?? null,
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

    // Upsert onsite_quote_requests by conversation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sel: any = await (admin as any)
      .from("onsite_quote_requests")
      .select("id,status")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = sel?.data as unknown as Array<{ id?: string }> | null;
    const existingRow =
      Array.isArray(existing) && existing.length ? (existing[0] as any) : null;
    if (existingRow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateResult = await (admin as any)
        .from("onsite_quote_requests")
        .update({
          status: "scheduled",
          schedule_date: date,
          schedule_time_start: time_start,
          schedule_time_end: time_end,
          details: notes || null,
          notes: notes || null,
        })
        .eq("id", existingRow.id);
      if (updateResult?.error) {
        return errorResponse(
          500,
          "ONSITE_QUOTE_REQUEST_UPDATE_FAILED",
          (updateResult.error as { message?: string } | null)?.message || null,
          (updateResult.error as { code?: string } | null)?.code || null,
        );
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertResult = await (admin as any)
        .from("onsite_quote_requests")
        .insert({
          conversation_id,
          request_id: null,
          professional_id: participantProfiles.professionalProfileId,
          client_id: participantProfiles.clientProfileId,
          status: "scheduled",
          schedule_date: date,
          schedule_time_start: time_start,
          schedule_time_end: time_end,
          details: notes || null,
          notes: notes || null,
          deposit_amount: 200,
        } as any);
      if (insertResult?.error) {
        return errorResponse(
          500,
          "ONSITE_QUOTE_REQUEST_INSERT_FAILED",
          (insertResult.error as { message?: string } | null)?.message || null,
          (insertResult.error as { code?: string } | null)?.code || null,
        );
      }
    }

    // Trigger handles chat message
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return errorResponse(400, msg);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
