import type {
  AudienceType,
  BrandContext,
  CampaignGoal,
  ChannelType,
} from "@/lib/ai/schemas";
import {
  APPROVED_CLAIMS,
  CAUTION_CLAIMS,
  PROHIBITED_CLAIMS,
} from "@/lib/brand/claims";
import { CHANNEL_RULES } from "@/lib/brand/channel-rules";
import { CONTENT_PILLARS } from "@/lib/brand/content-pillars";
import { AUDIENCE_SEGMENTS } from "@/lib/brand/audiences";
import {
  CORE_TONE_RULES,
  TONE_BY_AUDIENCE,
  TONE_BY_CHANNEL,
} from "@/lib/brand/tone";
import { VISUAL_RULES } from "@/lib/brand/visual-rules";

function asBulletList(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

export function buildBrandContext(input: {
  audience: AudienceType;
  goal: CampaignGoal;
  channel?: ChannelType | null;
  serviceCategory: string;
  offer: string;
  cta: string;
}): BrandContext {
  const audience = AUDIENCE_SEGMENTS[input.audience];
  const channelRules = input.channel
    ? CHANNEL_RULES[input.channel]
    : CHANNEL_RULES.email;
  const audienceTone = TONE_BY_AUDIENCE[input.audience];
  const channelTone = input.channel
    ? TONE_BY_CHANNEL[input.channel]
    : TONE_BY_CHANNEL.email;

  return {
    brandName: "Handi",
    audience: input.audience,
    goal: input.goal,
    channel: input.channel ?? null,
    serviceCategory: input.serviceCategory,
    offer: input.offer,
    cta: input.cta,
    essence:
      "A practical and reliable bridge between people and trusted pros for home and office services.",
    positioning:
      "Handi is a trust-first marketplace that makes service hiring feel clear, safe, and useful.",
    mission:
      "Offer a practical and reliable platform for home and office services, connecting people with experts in a safe and efficient way.",
    values: [
      "Trust",
      "Professionalism",
      "Closeness",
      "Security",
      "Teamwork",
      "Human sense",
    ],
    voiceSummary: [
      ...CORE_TONE_RULES.summary,
      ...audienceTone.summary,
      ...channelTone.summary,
    ],
    languageRules: [
      "Use clean grammar and simple communication.",
      "Keep light Spanglish optional and superficial only.",
      "Avoid aggressive, gimmicky, or overpromising language.",
      "Make the next action easy to understand.",
    ],
    doList: [
      ...CORE_TONE_RULES.doList,
      ...audienceTone.doList,
      ...channelTone.doList,
    ],
    dontList: [
      ...CORE_TONE_RULES.dontList,
      ...audienceTone.dontList,
      ...channelTone.dontList,
    ],
    approvedClaims: APPROVED_CLAIMS,
    cautionClaims: CAUTION_CLAIMS,
    prohibitedClaims: PROHIBITED_CLAIMS,
    audienceInsights: {
      label: audience.label,
      summary: audience.summary,
      jobsToBeDone: audience.jobsToBeDone,
      trustTriggers: audience.trustTriggers,
      objections: audience.objections,
    },
    channelRules,
    contentPillars: CONTENT_PILLARS[input.audience].map(
      (pillar) => pillar.title,
    ),
    visualRules: VISUAL_RULES,
  };
}

export function buildBrandMasterPrompt(context: BrandContext): string {
  return [
    "You are generating campaign or content assets for Handi.",
    "",
    "Brand essence:",
    `- ${context.essence}`,
    "",
    "Positioning:",
    `- ${context.positioning}`,
    "",
    "Mission:",
    `- ${context.mission}`,
    "",
    "Audience:",
    `- ${context.audienceInsights.label}: ${context.audienceInsights.summary}`,
    "",
    "Audience jobs to be done:",
    asBulletList(context.audienceInsights.jobsToBeDone),
    "",
    "Audience trust triggers:",
    asBulletList(context.audienceInsights.trustTriggers),
    "",
    "Audience objections:",
    asBulletList(context.audienceInsights.objections),
    "",
    "Tone summary:",
    asBulletList(context.voiceSummary),
    "",
    "Language rules:",
    asBulletList(context.languageRules),
    "",
    "Do:",
    asBulletList(context.doList),
    "",
    "Do not:",
    asBulletList(context.dontList),
    "",
    "Approved claims:",
    asBulletList(context.approvedClaims),
    "",
    "Claims to use carefully:",
    asBulletList(context.cautionClaims),
    "",
    "Forbidden claims:",
    asBulletList(context.prohibitedClaims),
    "",
    "Channel rules:",
    `- Purpose: ${context.channelRules.purpose}`,
    "- Style:",
    asBulletList(context.channelRules.style),
    "- Channel do list:",
    asBulletList(context.channelRules.doList),
    "- Channel dont list:",
    asBulletList(context.channelRules.dontList),
    "- CTA rules:",
    asBulletList(context.channelRules.ctaRules),
    "",
    "Content pillars to respect:",
    asBulletList(context.contentPillars),
    "",
    "Visual consistency reminders:",
    "- Palette:",
    asBulletList(context.visualRules.palette),
    "- Typography:",
    asBulletList(context.visualRules.typography),
    "- Art direction:",
    asBulletList(context.visualRules.artDirection),
    "- Iconography:",
    asBulletList(context.visualRules.iconography),
    "",
    "Consistency reminders:",
    "- Sound like Handi, not a generic ad tool.",
    "- Lower uncertainty in every asset.",
    "- Make the copy feel trustworthy, modern, and useful.",
    "- Keep the CTA specific and calm.",
    "- Match every claim with believable language.",
  ].join("\n");
}
