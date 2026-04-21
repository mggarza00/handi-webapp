import type { BrandContext, ContentGenerationInput } from "@/lib/ai/schemas";
import { buildBrandMasterPrompt } from "@/lib/ai/prompts/brand-master";

export function buildPushPrompt(args: {
  input: ContentGenerationInput;
  brandContext: BrandContext;
  recommendedAngle: string;
}): string {
  const { input, brandContext, recommendedAngle } = args;
  return [
    buildBrandMasterPrompt(brandContext),
    "",
    "Channel task: Push notification",
    "- Output should be concise, trigger-aware, and highly relevant.",
    "- Keep one idea only.",
    "",
    "Structured brief:",
    `- Audience: ${input.audience}`,
    `- Goal: ${input.goal}`,
    `- Service category: ${input.serviceCategory}`,
    `- Offer: ${input.offer}`,
    `- CTA: ${input.cta}`,
    `- Recommended angle: ${recommendedAngle}`,
    `- Notes: ${input.notes || "none"}`,
    "",
    "Generation instructions:",
    "- Use short copy with a visible action.",
    "- Avoid generic reminders and fake urgency.",
    "- Make it feel timely and useful.",
  ].join("\n");
}
