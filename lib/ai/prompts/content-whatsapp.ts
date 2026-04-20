import type { BrandContext, ContentGenerationInput } from "@/lib/ai/schemas";
import { buildBrandMasterPrompt } from "@/lib/ai/prompts/brand-master";

export function buildWhatsAppPrompt(args: {
  input: ContentGenerationInput;
  brandContext: BrandContext;
  recommendedAngle: string;
}): string {
  const { input, brandContext, recommendedAngle } = args;
  return [
    buildBrandMasterPrompt(brandContext),
    "",
    "Channel task: WhatsApp message",
    "- Output should feel like a useful, human follow-up.",
    "- Keep it short and skimmable.",
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
    "- Open with clear context.",
    "- Use short message blocks.",
    "- Sound helpful, not spammy or robotic.",
    "- End with one easy next step.",
  ].join("\n");
}
