import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { generateContentProposal } from "@/lib/campaigns/generation";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { generateCampaignPlacementCopy } from "@/lib/campaigns/repository";
import {
  CREATIVE_PLACEMENT_IDS,
  type CreativePlacementId,
} from "@/lib/creative/placements";
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
    const campaignMessageId =
      typeof payload.campaignMessageId === "string"
        ? payload.campaignMessageId
        : "";
    const placementId =
      typeof payload.placementId === "string" ? payload.placementId : "";

    if (
      !campaignMessageId ||
      !CREATIVE_PLACEMENT_IDS.includes(placementId as CreativePlacementId)
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload" },
        { status: 422, headers: JSONH },
      );
    }

    const redirectTo =
      typeof payload.redirectTo === "string"
        ? payload.redirectTo
        : `/admin/campaigns/${params.id}`;
    const admin = getAdminSupabase();
    const result = await generateCampaignPlacementCopy({
      admin,
      campaignMessageId,
      placementId: placementId as CreativePlacementId,
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
      action: "PLACEMENT_COPY_GENERATED",
      entity: "campaign_drafts",
      entityId: result.draftId,
      meta: {
        note: `Placement-specific copy generated for ${placementId}.`,
        messageId: campaignMessageId,
        placementId,
        providerName: result.placementCopy.provider_metadata.providerName,
        generationMode: result.placementCopy.provider_metadata.generationMode,
        generationModel: result.placementCopy.provider_metadata.model,
        fallbackReason: result.placementCopy.provider_metadata.fallbackReason,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo,
      payload: {
        ok: true,
        draftId: result.draftId,
        placementCopy: result.placementCopy,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to generate placement copy";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
