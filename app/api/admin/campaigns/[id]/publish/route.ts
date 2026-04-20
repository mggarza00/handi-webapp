import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { channelTypes } from "@/lib/ai/schemas";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import {
  CAMPAIGN_PUBLISH_MODES,
  type CampaignPublishMode,
  type PublishChannel,
} from "@/lib/campaigns/workflow";
import {
  parsePublishTargeting,
  publishCampaign,
} from "@/lib/campaigns/publish";
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
    const channel = typeof payload.channel === "string" ? payload.channel : "";
    const publishMode =
      typeof payload.publishMode === "string" ? payload.publishMode : undefined;
    const targeting = parsePublishTargeting({
      targetEmails:
        typeof payload.targetEmails === "string" ? payload.targetEmails : "",
      targetUserIds:
        typeof payload.targetUserIds === "string" ? payload.targetUserIds : "",
      targetPhone:
        typeof payload.targetPhone === "string" ? payload.targetPhone : "",
    });

    if (!channel) {
      return NextResponse.json(
        { ok: false, error: "channel_required" },
        { status: 422, headers: JSONH },
      );
    }
    const normalizedChannel = channel.trim();
    const isSupportedChannel =
      channelTypes.includes(
        normalizedChannel as (typeof channelTypes)[number],
      ) || normalizedChannel === "google";
    if (!isSupportedChannel) {
      return NextResponse.json(
        { ok: false, error: "invalid_channel" },
        { status: 422, headers: JSONH },
      );
    }
    if (
      publishMode &&
      !CAMPAIGN_PUBLISH_MODES.includes(publishMode as CampaignPublishMode)
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_publish_mode" },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const result = await publishCampaign({
      admin,
      campaignId: params.id,
      channel: normalizedChannel as PublishChannel,
      publishMode: publishMode as CampaignPublishMode | undefined,
      targeting,
      triggeredBy: gate.userId,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_PUBLISH_STARTED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: `Publish requested for ${result.channel} in ${result.mode} mode.`,
        channel: result.channel,
        publishMode: result.mode,
        publishJobId: result.job.id,
        messageId: result.messageId,
      },
    });

    await logAudit({
      actorId: gate.userId,
      action: result.ok
        ? "CAMPAIGN_PUBLISH_SUCCEEDED"
        : "CAMPAIGN_PUBLISH_FAILED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: result.ok
          ? result.job.provider_response_summary
          : result.errorMessage || result.job.provider_response_summary,
        channel: result.channel,
        publishMode: result.mode,
        publishJobId: result.job.id,
        messageId: result.messageId,
        error: result.errorMessage,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${params.id}`,
      payload: {
        ok: result.ok,
        campaignId: params.id,
        publishJob: result.job,
        errorMessage: result.errorMessage,
      },
      status: result.ok ? 200 : 500,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to publish campaign";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
