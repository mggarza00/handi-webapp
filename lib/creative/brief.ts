import type {
  CampaignDraftRow,
  CampaignMessageView,
  PublishChannel,
} from "@/lib/campaigns/workflow";
import { labelChannel, labelGoal } from "@/lib/campaigns/workflow";
import {
  buildVisualGuardrails,
  BRAND_VISUAL_GUARDS,
} from "@/lib/creative/brand-visual-guards";
import type {
  CreativeAssetFormat,
  CreativeBriefPayload,
} from "@/lib/creative/workflow";

export type CreativeBriefInput = {
  campaign: CampaignDraftRow;
  message: CampaignMessageView | null;
  channel: PublishChannel;
  format?: CreativeAssetFormat | null;
  notes?: string | null;
  references?: string[];
};

export function defaultCreativeFormatForChannel(
  channel: PublishChannel,
): CreativeAssetFormat {
  if (channel === "meta") return "square";
  if (channel === "email") return "landscape";
  if (channel === "push") return "portrait";
  if (channel === "whatsapp") return "portrait";
  if (channel === "landing") return "landscape";
  return "landscape";
}

function buildHeadlineCue(input: CreativeBriefInput) {
  return (
    input.message?.content.headline ||
    input.campaign.recommended_angle ||
    input.campaign.title
  );
}

function buildCopyCue(input: CreativeBriefInput) {
  return (
    input.message?.content.body ||
    input.campaign.rationale_summary ||
    input.campaign.offer
  );
}

export function buildCreativeBrief(
  input: CreativeBriefInput,
): CreativeBriefPayload {
  const targetFormat =
    input.format || defaultCreativeFormatForChannel(input.channel);
  const headlineCue = buildHeadlineCue(input);
  const copyCue = buildCopyCue(input);
  const visualGuards = buildVisualGuardrails();

  const compositionNotes = [
    BRAND_VISUAL_GUARDS.formatNotes[targetFormat],
    BRAND_VISUAL_GUARDS.compositionPatterns[0],
    `Design for ${labelChannel(input.channel)} and keep the CTA area aligned with "${input.campaign.cta}".`,
  ];

  const visualConstraints = [
    ...visualGuards.doList,
    ...visualGuards.dontList.map((item) => `Avoid: ${item}`),
    ...visualGuards.copyToVisualRules,
  ];

  const textOverlayGuidance = [
    `Primary overlay cue: "${headlineCue}".`,
    `Support cue: "${input.campaign.offer}".`,
    BRAND_VISUAL_GUARDS.overlayTextLimits[
      targetFormat === "story" ? "medium" : "low"
    ],
  ];

  const briefSummary = [
    `${labelChannel(input.channel)} asset for ${input.campaign.audience}.`,
    `Goal: ${labelGoal(input.campaign.goal)}.`,
    `Service: ${input.campaign.service_category}.`,
    `Angle: ${input.campaign.recommended_angle}.`,
  ].join(" ");

  const rationaleSummary = [
    `The visual should support the campaign angle "${input.campaign.recommended_angle}" and make the offer feel trustworthy.`,
    `Use ${labelChannel(input.channel)} framing so the CTA "${input.campaign.cta}" feels natural for the audience.`,
    input.message
      ? `Keep the asset aligned with the selected copy variant "${input.message.variant_name}".`
      : "Use the campaign brief as the source of truth for the visual hierarchy.",
  ].join(" ");

  const visualPrompt = [
    `Create a static campaign image for Handi.`,
    `Audience: ${input.campaign.audience}.`,
    `Goal: ${input.campaign.goal}.`,
    `Channel: ${input.channel}.`,
    `Target format: ${targetFormat}.`,
    `Service category: ${input.campaign.service_category}.`,
    `Offer: ${input.campaign.offer}.`,
    `CTA cue: ${input.campaign.cta}.`,
    `Headline cue: ${headlineCue}.`,
    `Copy support cue: ${copyCue}.`,
    `Art direction: ${visualGuards.artDirection.join(" ")}`,
    `Palette: ${visualGuards.palette.join(" ")}`,
    `Typography: ${visualGuards.typography.join(" ")}`,
    `Composition notes: ${compositionNotes.join(" ")}`,
    `Constraints: ${visualConstraints.join(" ")}`,
    input.notes?.trim() ? `Extra notes: ${input.notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    visualPrompt,
    briefSummary,
    rationaleSummary,
    targetFormat,
    compositionNotes,
    visualConstraints,
    textOverlayGuidance,
    references: input.references || [],
    channel: input.channel,
    serviceCategory: input.campaign.service_category,
    audience: input.campaign.audience,
    goal: input.campaign.goal,
  };
}
