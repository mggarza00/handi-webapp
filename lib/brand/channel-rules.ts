import type { ChannelType } from "@/lib/ai/schemas";

export type ChannelRuleSet = {
  purpose: string;
  style: string[];
  doList: string[];
  dontList: string[];
  ctaRules: string[];
};

export const CHANNEL_RULES: Record<ChannelType, ChannelRuleSet> = {
  meta: {
    purpose:
      "Capture attention fast and move the audience into a clear next step.",
    style: ["Benefit-first", "Short and scannable", "Trust signal early"],
    doList: [
      "Use one core value proposition.",
      "Tie the message to a specific service need or offer.",
      "Keep copy easy to understand in one pass.",
    ],
    dontList: [
      "Do not use crowded paragraphs.",
      "Do not combine too many benefits at once.",
      "Do not rely on exaggerated urgency.",
    ],
    ctaRules: [
      "Use one direct CTA.",
      "Prefer action verbs like find, request, start, or learn.",
    ],
  },
  email: {
    purpose:
      "Explain value with enough room for reassurance, proof, and a clear CTA.",
    style: [
      "Structured",
      "Warm but professional",
      "Narrative with clear sections",
    ],
    doList: [
      "Explain why the email matters near the top.",
      "Use a clear body flow: context, value, action.",
      "Make the CTA visible and calm.",
    ],
    dontList: [
      "Do not use clickbait subject lines.",
      "Do not overstuff the body with secondary points.",
      "Do not sound like a generic blast.",
    ],
    ctaRules: [
      "One primary CTA is enough.",
      "Support with a trust-oriented line if needed.",
    ],
  },
  whatsapp: {
    purpose:
      "Deliver a helpful follow-up message that feels timely, human, and low-friction.",
    style: ["Conversational", "Short blocks", "Context-first"],
    doList: [
      "Start with why the recipient is hearing from Handi.",
      "Keep each block short.",
      "End with a concrete next step.",
    ],
    dontList: [
      "Do not sound like spam.",
      "Do not overuse emojis.",
      "Do not bury the CTA in a long paragraph.",
    ],
    ctaRules: [
      "The CTA should feel easy and immediate.",
      "Use reply-friendly language when appropriate.",
    ],
  },
  push: {
    purpose:
      "Trigger one immediate action with the least amount of copy possible.",
    style: ["Short", "Relevant", "Direct"],
    doList: [
      "Match the copy to the trigger.",
      "Keep the action obvious.",
      "Prefer specificity over cleverness.",
    ],
    dontList: [
      "Do not be vague.",
      "Do not invent urgency.",
      "Do not include more than one idea.",
    ],
    ctaRules: ["Use implied action in the body.", "Keep CTA language compact."],
  },
  landing: {
    purpose:
      "Turn campaign interest into confidence and action with a clear narrative.",
    style: ["Structured", "Benefit-first", "Trust-building"],
    doList: [
      "Open with what Handi is and why it matters.",
      "Use proof, process, and CTA blocks in sequence.",
      "Match the promise to a concrete service context.",
    ],
    dontList: [
      "Do not use abstract headline-only storytelling.",
      "Do not overload the hero with multiple CTAs.",
      "Do not hide trust language deep in the page.",
    ],
    ctaRules: [
      "Primary CTA should be visible early.",
      "Repeat CTA only after adding more proof or context.",
    ],
  },
};

export function getChannelGuardrails(channel: ChannelType): string[] {
  const ruleSet = CHANNEL_RULES[channel];
  return [...ruleSet.doList, ...ruleSet.dontList, ...ruleSet.ctaRules];
}
