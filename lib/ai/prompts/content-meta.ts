import type { BrandContext, ContentGenerationInput } from "@/lib/ai/schemas";
import { buildBrandMasterPrompt } from "@/lib/ai/prompts/brand-master";

export function buildMetaAdPrompt(args: {
  input: ContentGenerationInput;
  brandContext: BrandContext;
  recommendedAngle: string;
}): string {
  const { input, brandContext, recommendedAngle } = args;
  return [
    buildBrandMasterPrompt(brandContext),
    "",
    "Channel task: Meta ad copy",
    "- Output should be concise, scroll-stopping, and easy to understand.",
    "- Keep one strong idea and one CTA.",
    "",
    "Structured brief:",
    `- Audience: ${input.audience}`,
    `- Goal: ${input.goal}`,
    `- Channel: ${input.channel}`,
    `- Format: ${input.format}`,
    `- Service category: ${input.serviceCategory}`,
    `- Offer: ${input.offer}`,
    `- CTA: ${input.cta}`,
    `- Recommended angle: ${recommendedAngle}`,
    `- Notes: ${input.notes || "none"}`,
    "",
    "Generation instructions:",
    "- Lead with the user benefit or service relief.",
    "- Add one trust cue early.",
    "- Keep the tone clear, calm, and modern.",
    "- Avoid ad cliches and fake urgency.",
  ].join("\n");
}
