import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { logCreativeBundleSyncAudit } from "@/lib/creative/bundle-audit";
import { syncCampaignCreativeBundles } from "@/lib/creative/bundles";
import { updateCreativeAssetJobStatus } from "@/lib/creative/repository";
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
    const note =
      typeof payload.feedbackNote === "string"
        ? payload.feedbackNote
        : typeof payload.feedback_note === "string"
          ? payload.feedback_note
          : "";
    const redirectTo =
      typeof payload.redirectTo === "string" ? payload.redirectTo : null;
    const admin = getAdminSupabase();
    const result = await updateCreativeAssetJobStatus({
      admin,
      jobId: params.id,
      status: "changes_requested",
      feedbackType: "request_changes",
      feedbackNote: note,
      createdBy: gate.userId,
    });

    await logAudit({
      actorId: gate.userId,
      action:
        result.jobType === "adaptation"
          ? "CREATIVE_ASSET_ADAPTATION_CHANGES_REQUESTED"
          : "CREATIVE_ASSET_CHANGES_REQUESTED",
      entity: "campaign_drafts",
      entityId: result.campaignDraftId,
      meta: {
        creativeAssetJobId: result.jobId,
        parentCreativeAssetId: result.parentCreativeAssetId,
        note,
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
      redirectTo: redirectTo || `/admin/creative-assets/${params.id}`,
      payload: { ok: true, id: params.id, status: "changes_requested" },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to request creative asset changes";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
