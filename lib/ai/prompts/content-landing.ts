import type { BrandContext, ContentGenerationInput } from "@/lib/ai/schemas";
import { buildBrandMasterPrompt } from "@/lib/ai/prompts/brand-master";

export function buildLandingPrompt(args: {
  input: ContentGenerationInput;
  brandContext: BrandContext;
  recommendedAngle: string;
}): string {
  const { input, brandContext, recommendedAngle } = args;
  return [
    buildBrandMasterPrompt(brandContext),
    "",
    "Channel task: Landing copy",
    "- Output should provide a clear narrative from value to trust to action.",
    "- Keep hierarchy obvious and benefit-first.",
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
    "- Hero should explain the value clearly.",
    "- Support claims with process or trust proof.",
    "- Keep sections structured and easy to skim.",
    "- Use CTA repetition only after adding context or proof.",
  ].join("\n");
}
