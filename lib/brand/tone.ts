import type { AudienceType, ChannelType } from "@/lib/ai/schemas";

export type ToneRuleSet = {
  summary: string[];
  doList: string[];
  dontList: string[];
};

export const CORE_TONE_RULES: ToneRuleSet = {
  summary: [
    "Clear, confident, close, useful, and modern.",
    "Professional without sounding cold.",
    "Light wit only when it improves recall and never at the cost of trust.",
  ],
  doList: [
    "Use clean grammar and direct wording.",
    "Lower uncertainty in every message.",
    "Keep the audience and next action obvious.",
    "Use very light Spanglish only when natural and optional.",
  ],
  dontList: [
    "Do not sound aggressive or gimmicky.",
    "Do not overpromise outcomes, speed, or savings.",
    "Do not use cluttered or confusing language.",
    "Do not force humor or English phrases.",
  ],
};

export const TONE_BY_AUDIENCE: Record<AudienceType, ToneRuleSet> = {
  client: {
    summary: [
      "Reassuring and low-friction.",
      "Helpful, calm, and confidence-building.",
    ],
    doList: [
      "Lead with relief, trust, or ease.",
      "Use concrete service outcomes.",
      "Make safety and clarity feel tangible.",
    ],
    dontList: [
      "Do not overcomplicate the service flow.",
      "Do not make the client feel rushed or naive.",
    ],
  },
  professional: {
    summary: [
      "Respectful, practical, and opportunity-driven.",
      "Speak to professional pride and seriousness.",
    ],
    doList: [
      "Acknowledge craft and experience.",
      "Frame the platform as a tool for better opportunities.",
      "Use straightforward business value.",
    ],
    dontList: [
      "Do not patronize or oversell easy money.",
      "Do not make the platform sound extractive.",
    ],
  },
  business: {
    summary: [
      "Ordered, competent, and operations-aware.",
      "Trustworthy without consumer-style fluff.",
    ],
    doList: [
      "Use process language when helpful.",
      "Highlight reliability and coordination.",
      "Keep copy concise and professional.",
    ],
    dontList: [
      "Do not use startup cliches.",
      "Do not make enterprise claims without support.",
    ],
  },
};

export const TONE_BY_CHANNEL: Record<ChannelType, ToneRuleSet> = {
  meta: {
    summary: ["Fast, clear, and benefit-first.", "Trust must appear early."],
    doList: [
      "Make the first line easy to scan.",
      "Use one message and one CTA.",
    ],
    dontList: [
      "Do not write dense paragraphs.",
      "Do not stack multiple claims in one ad.",
    ],
  },
  email: {
    summary: ["Structured and reassuring.", "Explain the why before the ask."],
    doList: [
      "Use visible hierarchy and short paragraphs.",
      "Keep the CTA calm and specific.",
    ],
    dontList: [
      "Do not use clickbait subject logic.",
      "Do not bury the core message.",
    ],
  },
  whatsapp: {
    summary: [
      "Conversational, short, and useful.",
      "Feels like a guided follow-up.",
    ],
    doList: [
      "Add context in the opening line.",
      "Keep blocks short and actionable.",
    ],
    dontList: ["Do not sound robotic.", "Do not send a wall of text."],
  },
  push: {
    summary: ["Short, relevant, and trigger-aware.", "One idea only."],
    doList: ["Keep language tight.", "Make the action easy to understand."],
    dontList: ["Do not be generic.", "Do not create fake urgency."],
  },
  landing: {
    summary: [
      "Clear hierarchy with trust and proof.",
      "Benefit-first and structurally clean.",
    ],
    doList: [
      "Use headlines that explain value plainly.",
      "Support claims with process or proof.",
    ],
    dontList: [
      "Do not use vague hero language.",
      "Do not overload sections with too many ideas.",
    ],
  },
};

export function getToneDirectives(
  audience: AudienceType,
  channel: ChannelType,
): string[] {
  return [
    ...CORE_TONE_RULES.summary,
    ...CORE_TONE_RULES.doList,
    ...TONE_BY_AUDIENCE[audience].summary,
    ...TONE_BY_AUDIENCE[audience].doList,
    ...TONE_BY_CHANNEL[channel].summary,
    ...TONE_BY_CHANNEL[channel].doList,
  ];
}
