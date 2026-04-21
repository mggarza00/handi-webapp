import { NextResponse } from "next/server";
import { Webhook } from "svix";

import {
  normalizeResendWebhookEvents,
  parseResendWebhookPayload,
  type ResendWebhookPayload,
} from "@/lib/campaigns/event-normalization";
import { processProviderEvents } from "@/lib/campaigns/provider-events";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function logWebhook(args: {
  provider: string;
  event: string;
  statusCode: number;
  payload: Record<string, unknown>;
}) {
  try {
    const admin = getAdminSupabase();
    await admin.from("webhooks_log").insert({
      provider: args.provider,
      event: args.event,
      status_code: args.statusCode,
      payload: args.payload,
    } as never);
  } catch {
    // best effort
  }
}

async function resolveResendPublishContext(
  admin: ReturnType<typeof getAdminSupabase>,
  payload: ResendWebhookPayload,
) {
  const emailId = payload.data.email_id?.trim() || null;
  const publishJobId =
    typeof payload.data.tags?.publish_job_id === "string"
      ? payload.data.tags.publish_job_id
      : null;
  const campaignId =
    typeof payload.data.tags?.campaign_id === "string"
      ? payload.data.tags.campaign_id
      : null;
  const messageId =
    typeof payload.data.tags?.message_id === "string"
      ? payload.data.tags.message_id
      : null;

  if (publishJobId) {
    const { data } = await admin
      .from("campaign_publish_jobs")
      .select("id, campaign_draft_id, message_id, channel")
      .eq("id", publishJobId)
      .maybeSingle();
    if (data) {
      const value = data as Record<string, unknown>;
      return {
        publishJobId: String(value.id),
        campaignDraftId: String(value.campaign_draft_id),
        campaignMessageId:
          typeof value.message_id === "string" ? value.message_id : messageId,
        channel:
          typeof value.channel === "string"
            ? (value.channel as "email")
            : "email",
      };
    }
  }

  if (emailId) {
    const { data } = await admin
      .from("campaign_publish_jobs")
      .select("id, campaign_draft_id, message_id, channel")
      .eq("external_reference_id", emailId)
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const value = data as Record<string, unknown>;
      return {
        publishJobId: String(value.id),
        campaignDraftId: String(value.campaign_draft_id),
        campaignMessageId:
          typeof value.message_id === "string" ? value.message_id : messageId,
        channel:
          typeof value.channel === "string"
            ? (value.channel as "email")
            : "email",
      };
    }
  }

  return {
    publishJobId: null,
    campaignDraftId: campaignId,
    campaignMessageId: messageId,
    channel: campaignId ? ("email" as const) : null,
  };
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const payloadForLogs = safeJsonParse(rawBody);
  const secret = (process.env.RESEND_WEBHOOK_SECRET || "").trim();

  if (!secret) {
    await logWebhook({
      provider: "resend",
      event: "config_missing",
      statusCode: 503,
      payload: payloadForLogs,
    });
    return NextResponse.json(
      { ok: false, error: "webhook_not_configured" },
      { status: 503 },
    );
  }

  const svixHeaders = {
    "svix-id": req.headers.get("svix-id") || "",
    "svix-timestamp": req.headers.get("svix-timestamp") || "",
    "svix-signature": req.headers.get("svix-signature") || "",
  };

  let verifiedPayload: unknown;
  try {
    verifiedPayload = new Webhook(secret).verify(rawBody, svixHeaders);
  } catch (error) {
    await logWebhook({
      provider: "resend",
      event: "signature_invalid",
      statusCode: 401,
      payload: payloadForLogs,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_signature",
        detail: error instanceof Error ? error.message : "verification_failed",
      },
      { status: 401 },
    );
  }

  let payload: ResendWebhookPayload;
  try {
    payload = parseResendWebhookPayload(verifiedPayload);
  } catch (error) {
    await logWebhook({
      provider: "resend",
      event: "payload_invalid",
      statusCode: 422,
      payload: payloadForLogs,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        detail: error instanceof Error ? error.message : "payload_invalid",
      },
      { status: 422 },
    );
  }

  try {
    await logWebhook({
      provider: "resend",
      event: payload.type,
      statusCode: 200,
      payload: payloadForLogs,
    });

    const admin = getAdminSupabase();
    const resolvedContext = await resolveResendPublishContext(admin, payload);
    const summary = await processProviderEvents({
      admin,
      events: normalizeResendWebhookEvents({
        payload,
        webhookId: svixHeaders["svix-id"] || null,
        resolvedContext,
      }),
      note: `Ingested live callback signal from Resend (${payload.type}).`,
    });

    return NextResponse.json({
      ok: true,
      provider: "resend",
      eventType: payload.type,
      ...summary,
    });
  } catch (error) {
    await logWebhook({
      provider: "resend",
      event: payload.type,
      statusCode: 500,
      payload: payloadForLogs,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "processing_failed",
        detail: error instanceof Error ? error.message : "processing_failed",
      },
      { status: 500 },
    );
  }
}
