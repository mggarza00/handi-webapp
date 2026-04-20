import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { editCampaignMessage } from "@/lib/campaigns/repository";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const payload = await readRequestPayload(req);
    const redirectTo =
      typeof payload.redirectTo === "string" ? payload.redirectTo : null;
    const admin = getAdminSupabase();
    const result = await editCampaignMessage({
      admin,
      messageId: params.id,
      createdBy: gate.userId,
      headline:
        typeof payload.headline === "string" ? payload.headline : undefined,
      body: typeof payload.body === "string" ? payload.body : undefined,
      cta: typeof payload.cta === "string" ? payload.cta : undefined,
      rationaleNote:
        typeof payload.rationaleNote === "string"
          ? payload.rationaleNote
          : typeof payload.feedback_note === "string"
            ? payload.feedback_note
            : undefined,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_MESSAGE_EDITED",
      entity: "campaign_messages",
      entityId: params.id,
      meta: {
        draftId: result.draftId,
        note:
          typeof payload.rationaleNote === "string"
            ? payload.rationaleNote
            : typeof payload.feedback_note === "string"
              ? payload.feedback_note
              : "",
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${result.draftId}`,
      payload: { ok: true, draftId: result.draftId, message: result.message },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to edit campaign message";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
