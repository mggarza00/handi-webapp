import type { CreativeBriefPayload } from "@/lib/creative/workflow";

export function buildCreativeProviderPromptBase(brief: CreativeBriefPayload) {
  return [
    "Create a static campaign image for Handi.",
    "The output must feel trustworthy, modern, useful, and editorial.",
    `Audience: ${brief.audience}.`,
    `Goal: ${brief.goal}.`,
    `Channel: ${brief.channel}.`,
    `Target format: ${brief.targetFormat}.`,
    `Service category: ${brief.serviceCategory}.`,
    `Brief summary: ${brief.briefSummary}.`,
    `Rationale summary: ${brief.rationaleSummary}.`,
    `Main visual prompt: ${brief.visualPrompt}.`,
    `Composition notes: ${brief.compositionNotes.join(" ")}`,
    `Visual constraints: ${brief.visualConstraints.join(" ")}`,
    `Text guidance: ${brief.textOverlayGuidance.join(" ")}`,
    "Keep any text inside the image short, credible, and subordinate to the visual hierarchy.",
    "Do not introduce spammy urgency, fake scarcity, or off-brand visual gimmicks.",
  ].join("\n");
}

export function buildCreativeVariantPrompt(args: {
  brief: CreativeBriefPayload;
  variantLabel: string;
  direction: string;
}) {
  return [
    buildCreativeProviderPromptBase(args.brief),
    `Variant label: ${args.variantLabel}.`,
    `Direction: ${args.direction}.`,
    `Keep the Handi brand cues visible without turning the asset into a banner full of copy.`,
  ].join("\n");
}

export function buildCreativeRegenerationPrompt(args: {
  brief: CreativeBriefPayload;
  previousPrompt: string;
  previousRationale: string;
  feedbackNote?: string | null;
}) {
  return [
    buildCreativeProviderPromptBase(args.brief),
    "Regenerate the current asset with the admin feedback applied.",
    `Previous prompt: ${args.previousPrompt}`,
    `Previous rationale: ${args.previousRationale}`,
    args.feedbackNote?.trim()
      ? `Admin feedback: ${args.feedbackNote.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
