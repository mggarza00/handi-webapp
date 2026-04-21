import type { CampaignGenerationInput, KpiSuggestion } from "@/lib/ai/schemas";

export type AnalystInput = CampaignGenerationInput & {
  recommendedAngle: string;
};

const KPI_BY_GOAL = {
  awareness: [
    [
      "Reach",
      "Measures how many relevant people saw the message.",
      "Growing qualified reach",
    ],
    [
      "CTR",
      "Shows whether the message creates enough curiosity to act.",
      "Stable click-through lift",
    ],
  ],
  acquisition: [
    [
      "Qualified leads",
      "Tracks whether the campaign attracts useful intent, not just attention.",
      "More high-intent leads",
    ],
    [
      "Landing conversion rate",
      "Shows if the message and page are aligned.",
      "Higher visit-to-action rate",
    ],
  ],
  activation: [
    [
      "First action rate",
      "Measures movement into the first meaningful product step.",
      "More users completing the first core action",
    ],
    [
      "CTA click rate",
      "Shows whether the offer and CTA are clear enough.",
      "Healthy action rate by channel",
    ],
  ],
  conversion: [
    [
      "Conversion rate",
      "Core signal of campaign effectiveness.",
      "More completed desired actions",
    ],
    [
      "Cost per conversion",
      "Keeps efficiency visible as volume grows.",
      "Stable or improving efficiency",
    ],
  ],
  retention: [
    [
      "Repeat engagement",
      "Shows whether existing users keep returning.",
      "More repeat sessions or opens",
    ],
    [
      "Repeat conversion",
      "Measures whether retention messaging drives action.",
      "More returning actions",
    ],
  ],
  reactivation: [
    [
      "Reactivation rate",
      "Tracks winback effectiveness.",
      "Dormant users returning",
    ],
    [
      "Time to return",
      "Shows whether the message creates timely action.",
      "Shorter return window",
    ],
  ],
  upsell: [
    [
      "Expansion rate",
      "Measures movement into a broader or higher-value use case.",
      "More accepted expansion offers",
    ],
    [
      "Offer interaction rate",
      "Shows whether the upsell proposition is clear and relevant.",
      "More engaged offer clicks",
    ],
  ],
  referral: [
    [
      "Referral intent rate",
      "Measures how willing the audience is to share or recommend.",
      "More referral actions",
    ],
    [
      "Referral conversion",
      "Tracks downstream value, not just shares.",
      "More successful referred actions",
    ],
  ],
  education: [
    [
      "Content engagement",
      "Shows whether the audience is actually consuming the material.",
      "More high-quality engagement",
    ],
    [
      "Next-step rate",
      "Measures whether education unlocks action.",
      "More users taking the next step",
    ],
  ],
} as const;

export function runAnalyst(input: AnalystInput): KpiSuggestion[] {
  const base = KPI_BY_GOAL[input.goal];
  const channelSpecific: KpiSuggestion[] = input.channels.map((channel) => ({
    metric:
      channel === "email"
        ? "Open and click quality"
        : channel === "whatsapp"
          ? "Reply or click-through rate"
          : channel === "push"
            ? "Open-to-action rate"
            : channel === "landing"
              ? "Scroll depth and CTA conversion"
              : "Thumb-stop and click-through rate",
    whyItMatters: `Tracks whether ${channel} is doing its job inside the campaign mix.`,
    targetSignal: `Healthy ${channel} engagement aligned with ${input.recommendedAngle.toLowerCase()}`,
  }));

  return [
    ...base.map(([metric, whyItMatters, targetSignal]) => ({
      metric,
      whyItMatters,
      targetSignal,
    })),
    ...channelSpecific,
  ];
}
