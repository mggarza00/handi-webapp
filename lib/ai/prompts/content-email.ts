import type { BrandContext, ContentGenerationInput } from "@/lib/ai/schemas";
import { buildBrandMasterPrompt } from "@/lib/ai/prompts/brand-master";

export function buildEmailPrompt(args: {
  input: ContentGenerationInput;
  brandContext: BrandContext;
  recommendedAngle: string;
}): string {
  const { input, brandContext, recommendedAngle } = args;
  return [
    buildBrandMasterPrompt(brandContext),
    "",
    "Channel task: Email copy",
    "- Output should feel structured, reassuring, and action-oriented.",
    "- Explain the value before asking for the click.",
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
    "- Subject line should be clear before clever.",
    "- Open with why the email matters now.",
    "- Use a clean body flow: context, value, CTA.",
    "- Keep the CTA calm, specific, and trustworthy.",
  ].join("\n");
}
