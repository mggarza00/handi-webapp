import { NextResponse } from "next/server";

import {
  normalizePushTrackingEvent,
  parsePushTrackingPayload,
} from "@/lib/campaigns/event-normalization";
import { processProviderEvents } from "@/lib/campaigns/provider-events";
import { verifyPushTrackingToken } from "@/lib/campaigns/push-tracking";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

async function logPushEvent(
  statusCode: number,
  payload: Record<string, unknown>,
) {
  try {
    const admin = getAdminSupabase();
    await admin.from("webhooks_log").insert({
      provider: "web-push",
      event:
        typeof payload.eventType === "string"
          ? payload.eventType
          : "push_event",
      status_code: statusCode,
      payload,
    } as never);
  } catch {
    // best effort
  }
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  let payload;

  try {
    payload = parsePushTrackingPayload(raw);
  } catch (error) {
    await logPushEvent(422, raw);
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        detail: error instanceof Error ? error.message : "payload_invalid",
      },
      { status: 422, headers: JSONH },
    );
  }

  const trackingValid = verifyPushTrackingToken(
    {
      campaignId: payload.campaignId,
      messageId: payload.messageId || null,
      publishJobId: payload.publishJobId,
      subscriptionId: payload.subscriptionId,
      targetUserId: payload.targetUserId || null,
      dispatchId:
        typeof payload.metadata.dispatchId === "string"
          ? payload.metadata.dispatchId
          : payload.providerEventId || "",
    },
    payload.trackingToken,
  );

  if (!trackingValid) {
    await logPushEvent(401, raw);
    return NextResponse.json(
      { ok: false, error: "invalid_tracking_token" },
      { status: 401, headers: JSONH },
    );
  }

  const admin = getAdminSupabase();
  const { data } = await admin
    .from("campaign_publish_jobs")
    .select("id, campaign_draft_id, message_id, channel")
    .eq("id", payload.publishJobId)
    .maybeSingle();

  if (!data) {
    await logPushEvent(404, raw);
    return NextResponse.json(
      { ok: false, error: "publish_job_not_found" },
      { status: 404, headers: JSONH },
    );
  }

  const value = data as Record<string, unknown>;
  if (value.channel !== "push") {
    await logPushEvent(409, raw);
    return NextResponse.json(
      { ok: false, error: "publish_job_channel_mismatch" },
      { status: 409, headers: JSONH },
    );
  }
  const resolvedContext = {
    publishJobId: String(value.id),
    campaignDraftId: String(value.campaign_draft_id),
    campaignMessageId:
      typeof value.message_id === "string"
        ? value.message_id
        : payload.messageId || null,
    channel: "push" as const,
  };

  if (
    resolvedContext.campaignDraftId !== payload.campaignId ||
    (payload.messageId &&
      resolvedContext.campaignMessageId !== payload.messageId)
  ) {
    await logPushEvent(409, raw);
    return NextResponse.json(
      { ok: false, error: "tracking_payload_mismatch" },
      { status: 409, headers: JSONH },
    );
  }

  try {
    await logPushEvent(200, raw);
    const summary = await processProviderEvents({
      admin,
      events: [
        normalizePushTrackingEvent({
          payload: {
            ...payload,
            providerEventId:
              payload.providerEventId ||
              `${payload.publishJobId}:${payload.subscriptionId}:${payload.eventType}`,
            metadata: {
              ...payload.metadata,
              dispatchId:
                typeof payload.metadata.dispatchId === "string"
                  ? payload.metadata.dispatchId
                  : payload.providerEventId || "",
            },
          },
          resolvedContext,
        }),
      ],
      note: `Ingested live push callback signal (${payload.eventType}).`,
    });

    return NextResponse.json(
      {
        ok: true,
        provider: "web-push",
        ...summary,
      },
      { headers: JSONH },
    );
  } catch (error) {
    await logPushEvent(500, raw);
    return NextResponse.json(
      {
        ok: false,
        error: "processing_failed",
        detail: error instanceof Error ? error.message : "processing_failed",
      },
      { status: 500, headers: JSONH },
    );
  }
}
