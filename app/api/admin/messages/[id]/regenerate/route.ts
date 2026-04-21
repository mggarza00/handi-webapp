import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { generateContentProposal } from "@/lib/campaigns/generation";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { regenerateCampaignMessage } from "@/lib/campaigns/repository";
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
    const result = await regenerateCampaignMessage({
      admin,
      messageId: params.id,
      createdBy: gate.userId,
      feedbackNote:
        typeof payload.feedbackNote === "string"
          ? payload.feedbackNote
          : typeof payload.feedback_note === "string"
            ? payload.feedback_note
            : undefined,
      generator: generateContentProposal,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_MESSAGE_REGENERATED",
      entity: "campaign_messages",
      entityId: params.id,
      meta: {
        draftId: result.draftId,
        note:
          typeof payload.feedbackNote === "string"
            ? payload.feedbackNote
            : typeof payload.feedback_note === "string"
              ? payload.feedback_note
              : "",
        providerName: result.message.provider_metadata.providerName,
        generationMode: result.message.provider_metadata.generationMode,
        generationModel: result.message.provider_metadata.model,
        fallbackReason: result.message.provider_metadata.fallbackReason,
        requestId: result.message.provider_metadata.requestId,
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
        : "failed to regenerate campaign message";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
