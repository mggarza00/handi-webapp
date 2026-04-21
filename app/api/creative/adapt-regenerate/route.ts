import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { logCreativeBundleSyncAudit } from "@/lib/creative/bundle-audit";
import { syncCampaignCreativeBundles } from "@/lib/creative/bundles";
import { regenerateCreativeAssetAdaptation } from "@/lib/creative/repository";
import { creativeAdaptRegenerateInputSchema } from "@/lib/creative/schemas";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const raw = await readRequestPayload(req);
    const parsed = creativeAdaptRegenerateInputSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const result = await regenerateCreativeAssetAdaptation({
      admin,
      creativeAssetId: parsed.data.creativeAssetId,
      targetChannel: parsed.data.targetChannel,
      format: parsed.data.format,
      width: parsed.data.width,
      height: parsed.data.height,
      adaptationMethod: parsed.data.adaptationMethod,
      feedbackNote: parsed.data.feedbackNote,
      createdBy: gate.userId,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_ASSET_ADAPTATION_REGENERATED",
      entity: "campaign_drafts",
      entityId: result.campaignDraftId,
      meta: {
        creativeAssetJobId: result.creativeAssetJobId,
        creativeAssetId: result.creativeAssetId,
        parentCreativeAssetId: result.parentCreativeAssetId,
        channel: result.channel,
        note:
          parsed.data.feedbackNote?.trim() ||
          "Derivative asset regenerated from approved master.",
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_ASSET_VERSION_CREATED",
      entity: "campaign_drafts",
      entityId: result.campaignDraftId,
      meta: {
        creativeAssetJobId: result.creativeAssetJobId,
        creativeAssetId: result.creativeAssetId,
        parentCreativeAssetId: result.parentCreativeAssetId,
        channel: result.channel,
        note: "A new derivative asset version was saved.",
      },
    });
    const bundles = await syncCampaignCreativeBundles({
      admin,
      campaignId: result.campaignDraftId,
    });
    await logCreativeBundleSyncAudit({
      actorId: gate.userId,
      campaignId: result.campaignDraftId,
      bundles,
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo:
        parsed.data.redirectTo ||
        `/admin/creative-assets/${result.creativeAssetJobId}`,
      payload: {
        ok: true,
        creativeAssetJobId: result.creativeAssetJobId,
        creativeAssetId: result.creativeAssetId,
        campaignDraftId: result.campaignDraftId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to regenerate derivative asset";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
