import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { channelTypes } from "@/lib/ai/schemas";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { scheduleCampaignPublish } from "@/lib/campaigns/publish-queue";
import {
  CAMPAIGN_PUBLISH_MODES,
  type CampaignPublishMode,
  type PublishChannel,
} from "@/lib/campaigns/workflow";
import { parsePublishTargeting } from "@/lib/campaigns/publish";
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
      typeof payload.publishMode === "string" ? payload.publishMode : "draft";

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
    if (!CAMPAIGN_PUBLISH_MODES.includes(publishMode as CampaignPublishMode)) {
      return NextResponse.json(
        { ok: false, error: "invalid_publish_mode" },
        { status: 422, headers: JSONH },
      );
    }

    const targeting = parsePublishTargeting({
      targetEmails:
        typeof payload.targetEmails === "string" ? payload.targetEmails : "",
      targetUserIds:
        typeof payload.targetUserIds === "string" ? payload.targetUserIds : "",
      targetPhone:
        typeof payload.targetPhone === "string" ? payload.targetPhone : "",
    });

    const admin = getAdminSupabase();
    const job = await scheduleCampaignPublish({
      admin,
      campaignId: params.id,
      channel: normalizedChannel as PublishChannel,
      publishMode: publishMode as CampaignPublishMode,
      targeting,
      scheduledFor:
        typeof payload.scheduledFor === "string" ? payload.scheduledFor : null,
      executionWindowStart:
        typeof payload.executionWindowStart === "string"
          ? payload.executionWindowStart
          : null,
      executionWindowEnd:
        typeof payload.executionWindowEnd === "string"
          ? payload.executionWindowEnd
          : null,
      triggeredBy: gate.userId,
      maxRetries:
        typeof payload.maxRetries === "string" && payload.maxRetries
          ? Number(payload.maxRetries)
          : undefined,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_PUBLISH_SCHEDULED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: job.scheduled_for
          ? `Publish scheduled for ${job.scheduled_for}.`
          : "Publish job queued for the next internal run.",
        publishJobId: job.id,
        channel: job.channel,
        publishMode: job.publish_mode,
        queueStatus: job.queue_status,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${params.id}`,
      payload: {
        ok: true,
        campaignId: params.id,
        publishJob: job,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to schedule publish job";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
