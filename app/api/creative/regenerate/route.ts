import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { logCreativeBundleSyncAudit } from "@/lib/creative/bundle-audit";
import { syncCampaignCreativeBundles } from "@/lib/creative/bundles";
import { regenerateCreativeAsset } from "@/lib/creative/repository";
import { creativeRegenerateInputSchema } from "@/lib/creative/schemas";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const raw = await readRequestPayload(req);
    const parsed = creativeRegenerateInputSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_payload",
          detail: parsed.error.flatten(),
        },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const result = await regenerateCreativeAsset({
      admin,
      creativeAssetId: parsed.data.creativeAssetId,
      feedbackNote: parsed.data.feedbackNote,
      createdBy: gate.userId,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_ASSET_REGENERATED",
      entity: "campaign_drafts",
      entityId: result.campaignDraftId,
      meta: {
        creativeAssetJobId: result.creativeAssetJobId,
        creativeAssetId: result.creativeAssetId,
        messageId: result.campaignMessageId,
        channel: result.channel,
        note:
          parsed.data.feedbackNote?.trim() ||
          "Creative asset regenerated from admin feedback.",
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
        messageId: result.campaignMessageId,
        channel: result.channel,
        note: "A new creative asset version was saved.",
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
        asset: result.asset,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to regenerate asset";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: JSONH },
  );
}
