import type {
  ContentGenerationInput,
  ProviderMetadata,
} from "@/lib/ai/schemas";
import { DEFAULT_FORMAT_BY_CHANNEL } from "@/lib/ai/schemas";
import { analyzeCampaignMessage } from "@/lib/campaigns/qa";
import { selectPublishMessage } from "@/lib/campaigns/publish";
import {
  buildDefaultMessageQaReport,
  labelChannel,
  type CampaignDraftRow,
  type CampaignMessageContent,
  type CampaignMessagePlacementSource,
  type CampaignMessagePlacementView,
  type CampaignMessageView,
  type CampaignVariantDecisionRow,
  type CampaignWorkflowStatus,
  type MessageQaReport,
  type PublishChannel,
  type StructuredMessageRationale,
} from "@/lib/campaigns/workflow";
import {
  getCreativePlacementDefinition,
  labelCreativePlacement,
  type CreativePlacementId,
} from "@/lib/creative/placements";

export type ResolvedPlacementCopy = {
  placementId: CreativePlacementId;
  placementLabel: string;
  channel: PublishChannel;
  baseMessageId: string | null;
  baseVariantName: string | null;
  placementMessageId: string | null;
  source: CampaignMessagePlacementSource;
  status: CampaignWorkflowStatus | "missing";
  inheritedFromChannel: boolean;
  content: CampaignMessageContent | null;
  rationale: string | null;
  rationaleParts: StructuredMessageRationale | null;
  qaReport: MessageQaReport | null;
  providerMetadata: ProviderMetadata | null;
  summary: string;
  warnings: string[];
  pendingPlacementCopy: CampaignMessagePlacementView | null;
};

function sortByUpdatedAtDesc<T extends { updated_at: string }>(items: T[]) {
  return [...items].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  );
}

export function resolvePlacementCopy(args: {
  channel: PublishChannel;
  placementId: CreativePlacementId;
  messages: CampaignMessageView[];
  decisions: CampaignVariantDecisionRow[];
  placementCopies: CampaignMessagePlacementView[];
  preferredMessageId?: string | null;
}): ResolvedPlacementCopy {
  const placement = getCreativePlacementDefinition(args.placementId);
  const baseMessage = selectPublishMessage({
    channel: args.channel,
    messages: args.messages,
    decisions: args.decisions,
    preferredMessageId: args.preferredMessageId || undefined,
  });

  if (!baseMessage) {
    return {
      placementId: args.placementId,
      placementLabel: placement.label,
      channel: args.channel,
      baseMessageId: null,
      baseVariantName: null,
      placementMessageId: null,
      source: "inherited",
      status: "missing",
      inheritedFromChannel: true,
      content: null,
      rationale: null,
      rationaleParts: null,
      qaReport: null,
      providerMetadata: null,
      summary:
        "No approved or selected channel-level message is available for this placement yet.",
      warnings: [
        "Placement copy cannot resolve until the channel has a usable base variant.",
      ],
      pendingPlacementCopy: null,
    };
  }

  const related = sortByUpdatedAtDesc(
    args.placementCopies.filter(
      (item) =>
        item.campaign_message_id === baseMessage.id &&
        item.placement_id === args.placementId &&
        item.channel === args.channel &&
        item.status !== "archived",
    ),
  );
  const approved = related.find((item) => item.status === "approved") || null;
  const pending = related.find((item) => item.status !== "approved") || null;

  if (approved) {
    return {
      placementId: args.placementId,
      placementLabel: placement.label,
      channel: args.channel,
      baseMessageId: baseMessage.id,
      baseVariantName: baseMessage.variant_name,
      placementMessageId: approved.id,
      source: approved.source,
      status: approved.status,
      inheritedFromChannel: approved.source === "inherited",
      content: approved.content,
      rationale: approved.rationale,
      rationaleParts: approved.rationale_parts,
      qaReport: approved.qa_report,
      providerMetadata: approved.provider_metadata,
      summary:
        approved.source === "manual_override"
          ? "Placement uses an approved manual override instead of channel-level copy."
          : "Placement uses approved copy generated specifically for this placement.",
      warnings: [],
      pendingPlacementCopy: pending,
    };
  }

  return {
    placementId: args.placementId,
    placementLabel: placement.label,
    channel: args.channel,
    baseMessageId: baseMessage.id,
    baseVariantName: baseMessage.variant_name,
    placementMessageId: null,
    source: "inherited",
    status: baseMessage.status,
    inheritedFromChannel: true,
    content: baseMessage.content,
    rationale: baseMessage.rationale,
    rationaleParts: baseMessage.rationale_parts,
    qaReport: baseMessage.qa_report,
    providerMetadata: baseMessage.provider_metadata,
    summary:
      "Placement currently inherits the selected channel-level copy because no approved placement-specific override exists.",
    warnings: pending
      ? [
          `A ${pending.source === "manual_override" ? "manual" : "placement-specific"} proposal exists but is still ${pending.status.replace(/_/g, " ")}.`,
        ]
      : [
          "Placement is inheriting channel-level copy. Create a placement-specific override if the handoff needs a tighter format-specific message.",
        ],
    pendingPlacementCopy: pending,
  };
}

export function buildPlacementCopyGenerationInput(args: {
  draft: Pick<
    CampaignDraftRow,
    | "id"
    | "title"
    | "audience"
    | "goal"
    | "service_category"
    | "offer"
    | "cta"
    | "notes"
  >;
  message: Pick<
    CampaignMessageView,
    "id" | "channel" | "format" | "variant_name" | "content" | "rationale"
  >;
  placementId: CreativePlacementId;
  feedbackNote?: string | null;
}): ContentGenerationInput {
  const placement = getCreativePlacementDefinition(args.placementId);
  const notes = [
    args.draft.notes,
    `Generate placement-specific copy for ${placement.label} (${placement.handoffName}).`,
    `Base variant: ${args.message.variant_name}.`,
    `Base headline: ${args.message.content.headline}`,
    `Base body: ${args.message.content.body}`,
    `Base CTA: ${args.message.content.cta}`,
    `Placement format: ${placement.requiredFormat}. Preferred dimensions: ${placement.preferredDimensions.width}x${placement.preferredDimensions.height}.`,
    `Placement notes: ${placement.notes.join(" ")}`,
    buildPlacementCopyGuidance(args.message.channel, args.placementId),
    args.feedbackNote ? `Feedback note: ${args.feedbackNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: args.draft.title,
    sourceCampaignDraftId: args.draft.id,
    audience: args.draft.audience,
    goal: args.draft.goal,
    channel: args.message.channel,
    format: DEFAULT_FORMAT_BY_CHANNEL[args.message.channel],
    serviceCategory: args.draft.service_category,
    offer: args.draft.offer,
    cta: args.draft.cta,
    notes,
    tonePreference: "",
  };
}

export function buildPlacementCopyGuidance(
  channel: CampaignMessageView["channel"],
  placementId: CreativePlacementId,
) {
  const placement = getCreativePlacementDefinition(placementId);
  if (placement.copyGuidance) {
    return placement.copyGuidance;
  }
  if (channel === "email") {
    return "Email placement copy can use a little more context, but it still needs to stay tighter than the base channel version.";
  }
  if (channel === "push") {
    return "Push placement copy must remain compact, low-friction, and CTA-led.";
  }
  if (channel === "whatsapp") {
    return "WhatsApp placement copy should sound direct, useful, and easy to reply to.";
  }
  return "Adjust the copy so it fits the placement constraints while keeping Handi clear, trustworthy, and practical.";
}

export function analyzePlacementCopy(args: {
  draft: Pick<
    CampaignDraftRow,
    | "audience"
    | "goal"
    | "service_category"
    | "offer"
    | "cta"
    | "brand_context"
    | "recommended_angle"
  >;
  message: Pick<CampaignMessageView, "channel" | "format" | "variant_name">;
  content: CampaignMessageContent;
  rationale: string;
}) {
  return analyzeCampaignMessage({
    draft: args.draft,
    message: {
      channel: args.message.channel,
      format: args.message.format,
      variant_name: args.message.variant_name,
      content: args.content,
      rationale: args.rationale,
    },
  });
}

export function buildPlacementCopyFallbackQaReport(
  summary: string,
): MessageQaReport {
  const report = buildDefaultMessageQaReport();
  return {
    ...report,
    summary,
  };
}

export function buildPlacementCopyExportSummary(
  resolution: ResolvedPlacementCopy,
) {
  if (!resolution.content) {
    return `No copy available for ${labelCreativePlacement(resolution.placementId)}.`;
  }

  if (resolution.inheritedFromChannel) {
    return `${labelCreativePlacement(resolution.placementId)} is inheriting ${labelChannel(resolution.channel)} copy from ${resolution.baseVariantName || "the selected channel variant"}.`;
  }

  return `${labelCreativePlacement(resolution.placementId)} uses ${resolution.source === "manual_override" ? "a manual override" : "placement-specific AI copy"} linked to ${resolution.baseVariantName || "the selected channel variant"}.`;
}
