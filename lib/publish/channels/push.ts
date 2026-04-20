import { randomUUID } from "node:crypto";

import webpush from "web-push";

import { createPushTrackingToken } from "@/lib/campaigns/push-tracking";
import { buildCreativeBundlePayload } from "@/lib/creative/bundles";
import type { PublishConnectorDefinition } from "@/lib/publish/types";

type PushSubscriptionRow = {
  id: string;
  user_id?: string | null;
  endpoint: string;
  keys?: {
    p256dh?: string | null;
    auth?: string | null;
  } | null;
  p256dh?: string | null;
  auth?: string | null;
};

const VAPID_SUBJECT =
  process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:soporte@handi.mx";
const VAPID_PUBLIC = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export const pushPublishConnector: PublishConnectorDefinition = {
  channel: "push",
  label: "Web push",
  supportedModes: ["live", "draft", "export"],
  defaultMode: "draft",
  capability: VAPID_PUBLIC && VAPID_PRIVATE ? "live" : "draft",
  description:
    "Sends approved push copy to explicit target users when VAPID keys are configured.",
  async execute(input) {
    const payload = {
      campaignId: input.campaign.id,
      publishJobId: input.publishJobId,
      messageId: input.message?.id || null,
      channel: "push",
      mode: input.mode,
      targetUserIds: input.targeting.targetUserIds,
      notification: {
        title: input.message?.content.headline || input.campaign.title,
        body: input.message?.content.body || input.campaign.rationale_summary,
        tag: `campaign-${input.campaign.id}`,
        data: {
          cta: input.message?.content.cta || input.campaign.cta,
          url: "/",
        },
      },
      creative: buildCreativeBundlePayload(input.creativeBundle),
    };

    if (input.mode !== "live") {
      return {
        publishStatus: "published",
        publishMode: input.mode,
        providerName: "web-push",
        providerResponseSummary:
          input.mode === "export"
            ? "Push payload exported for controlled delivery."
            : "Push draft prepared without sending.",
        payload,
        externalReferenceId: null,
        errorMessage: null,
        analyticsSnapshot: null,
      };
    }

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return {
        publishStatus: "publish_failed",
        publishMode: input.mode,
        providerName: "web-push",
        providerResponseSummary: "Push publish failed before send.",
        payload,
        externalReferenceId: null,
        errorMessage:
          "WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY are required for live push publishing.",
        analyticsSnapshot: null,
      };
    }

    if (!input.targeting.targetUserIds.length) {
      return {
        publishStatus: "publish_failed",
        publishMode: input.mode,
        providerName: "web-push",
        providerResponseSummary: "Push publish failed before send.",
        payload,
        externalReferenceId: null,
        errorMessage:
          "Live push publishing requires one or more target user IDs.",
        analyticsSnapshot: {
          events: [
            {
              campaignDraftId: input.campaign.id,
              campaignMessageId: input.message?.id || undefined,
              publishJobId: input.publishJobId,
              channel: "push",
              eventType: "failed",
              count: input.targeting.targetUserIds.length || 1,
              source: "push_dispatch_snapshot",
              metadata: {
                failureReason: "missing_target_user_ids",
              },
            },
          ],
        },
      };
    }

    const { data, error } = await input.admin
      .from("web_push_subscriptions")
      .select("id, user_id, endpoint, keys, p256dh, auth")
      .in("user_id", input.targeting.targetUserIds);

    if (error) {
      return {
        publishStatus: "publish_failed",
        publishMode: input.mode,
        providerName: "web-push",
        providerResponseSummary:
          error.message || "Failed to load push subscriptions.",
        payload,
        externalReferenceId: null,
        errorMessage: error.message || "Failed to load push subscriptions.",
        analyticsSnapshot: null,
      };
    }

    let sentCount = 0;
    let failedCount = 0;
    const successfulSubscriptionIds: string[] = [];
    for (const row of (data || []) as PushSubscriptionRow[]) {
      const rawKeys = row.keys || {
        p256dh: row.p256dh,
        auth: row.auth,
      };
      const subscription = {
        endpoint: row.endpoint,
        keys: {
          p256dh: rawKeys?.p256dh,
          auth: rawKeys?.auth,
        },
      };

      if (!subscription.keys.p256dh || !subscription.keys.auth) continue;
      const dispatchId = randomUUID();
      const trackingToken = createPushTrackingToken({
        campaignId: input.campaign.id,
        messageId: input.message?.id || null,
        publishJobId: input.publishJobId,
        subscriptionId: row.id,
        targetUserId: row.user_id || null,
        dispatchId,
      });
      const notificationPayload = {
        ...payload.notification,
        data: {
          ...payload.notification.data,
          campaignId: input.campaign.id,
          messageId: input.message?.id || null,
          publishJobId: input.publishJobId,
          channel: "push",
          subscriptionId: row.id,
          targetUserId: row.user_id || null,
          dispatchId,
          trackingToken,
        },
      };

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify(notificationPayload),
        );
        sentCount += 1;
        successfulSubscriptionIds.push(row.id);
      } catch {
        failedCount += 1;
        continue;
      }
    }

    if (!sentCount) {
      return {
        publishStatus: "publish_failed",
        publishMode: input.mode,
        providerName: "web-push",
        providerResponseSummary:
          "No push subscriptions were delivered successfully.",
        payload,
        externalReferenceId: null,
        errorMessage:
          "No active push subscriptions were found or all deliveries failed.",
        analyticsSnapshot: {
          events: [
            {
              campaignDraftId: input.campaign.id,
              campaignMessageId: input.message?.id || undefined,
              publishJobId: input.publishJobId,
              channel: "push",
              eventType: "failed",
              count: failedCount || input.targeting.targetUserIds.length || 1,
              source: "push_dispatch_snapshot",
              metadata: {
                failureReason: "no_successful_push_delivery",
              },
            },
          ],
        },
      };
    }

    return {
      publishStatus: "published",
      publishMode: input.mode,
      providerName: "web-push",
      providerResponseSummary: `Push delivered to ${sentCount} subscription${sentCount === 1 ? "" : "s"}.`,
      payload: {
        ...payload,
        signal: {
          mode: "callback_pending",
          successfulSubscriptions: sentCount,
          failedSubscriptions: failedCount,
          successfulSubscriptionIds,
        },
      },
      externalReferenceId: null,
      errorMessage: null,
      analyticsSnapshot:
        failedCount > 0
          ? {
              events: [
                {
                  campaignDraftId: input.campaign.id,
                  campaignMessageId: input.message?.id || undefined,
                  publishJobId: input.publishJobId,
                  channel: "push",
                  eventType: "failed",
                  count: failedCount,
                  source: "push_dispatch_snapshot",
                  metadata: {
                    failureReason: "partial_push_delivery_failure",
                  },
                },
              ],
            }
          : null,
    };
  },
};
