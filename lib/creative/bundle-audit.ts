import type { CampaignCreativeBundleView } from "@/lib/creative/workflow";
import { logAudit } from "@/lib/log-audit";

type LogCreativeBundleSyncAuditInput = {
  actorId: string | null;
  campaignId: string;
  bundles: CampaignCreativeBundleView[];
};

export async function logCreativeBundleSyncAudit(
  input: LogCreativeBundleSyncAuditInput,
) {
  const summary = input.bundles
    .map((bundle) => `${bundle.channel}: ${bundle.suitability_status}`)
    .join(" | ");

  await logAudit({
    actorId: input.actorId,
    action: "CREATIVE_BUNDLE_RESOLVED",
    entity: "campaign_drafts",
    entityId: input.campaignId,
    meta: {
      note: summary || "Creative bundle coverage refreshed.",
      bundles: input.bundles.map((bundle) => ({
        channel: bundle.channel,
        suitabilityStatus: bundle.suitability_status,
        selectionSource: bundle.selection_source,
        selectedAssetId: bundle.selected_asset?.id || null,
      })),
    },
  });
  await logAudit({
    actorId: input.actorId,
    action: "VISUAL_READINESS_EVALUATED",
    entity: "campaign_drafts",
    entityId: input.campaignId,
    meta: {
      note:
        summary || "Visual readiness refreshed from current creative bundles.",
    },
  });

  const readyChannels = input.bundles
    .filter((bundle) =>
      ["ready", "manual_override"].includes(bundle.suitability_status),
    )
    .map((bundle) => bundle.channel);
  if (readyChannels.length) {
    await logAudit({
      actorId: input.actorId,
      action: "CREATIVE_BUNDLE_READY",
      entity: "campaign_drafts",
      entityId: input.campaignId,
      meta: {
        note: `Creative coverage ready for ${readyChannels.join(", ")}.`,
      },
    });
    await Promise.all(
      readyChannels.map((channel) =>
        logAudit({
          actorId: input.actorId,
          action: "CREATIVE_BUNDLE_CHANNEL_READY",
          entity: "campaign_drafts",
          entityId: input.campaignId,
          meta: {
            channel,
            note: `Visual channel ready for ${channel}.`,
          },
        }),
      ),
    );
  }

  const missingChannels = input.bundles
    .filter((bundle) => bundle.suitability_status === "missing")
    .map((bundle) => bundle.channel);
  if (missingChannels.length) {
    await logAudit({
      actorId: input.actorId,
      action: "CREATIVE_BUNDLE_MISSING_DETECTED",
      entity: "campaign_drafts",
      entityId: input.campaignId,
      meta: {
        note: `Creative coverage missing for ${missingChannels.join(", ")}.`,
      },
    });
    await Promise.all(
      missingChannels.map((channel) =>
        logAudit({
          actorId: input.actorId,
          action: "CREATIVE_BUNDLE_CHANNEL_MISSING",
          entity: "campaign_drafts",
          entityId: input.campaignId,
          meta: {
            channel,
            note: `Visual channel missing for ${channel}.`,
          },
        }),
      ),
    );
  }
}
