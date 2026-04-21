import { VISUAL_RULES } from "@/lib/brand/visual-rules";
import type { CreativeAssetFormat } from "@/lib/creative/workflow";

export const BRAND_VISUAL_GUARDS = {
  principles: [
    "Trust and professionalism come before visual spectacle.",
    "The composition should feel useful, calm, and modern.",
    "Handi visuals should feel human and operational, not gimmicky.",
  ],
  doList: [
    "Use deep blue, light blue, beige, cream, and black as the core system.",
    "Keep hierarchy clean: one hero message, one support cue, one clear action.",
    "Show service context, confidence, and clarity rather than abstract hype.",
    "Leave enough breathing room so the asset feels editorial and controlled.",
  ],
  dontList: [
    "Do not overload the asset with text.",
    "Do not use aggressive urgency, clickbait framing, or spammy visual tricks.",
    "Do not make the image feel generic stock marketplace content.",
    "Do not let accent colors overpower the Handi brand base.",
  ],
  compositionPatterns: [
    "Editorial hero with clear service cue and one trust anchor.",
    "Human-centered scene with clean copy zone and quiet background.",
    "Offer-led composition with restrained category accent and strong CTA area.",
  ],
  copyToVisualRules: [
    "If text appears inside the image, keep it short and support the headline rather than repeating the full body copy.",
    "The visual should reinforce the campaign angle, not introduce a new message.",
    "CTA language can appear as a button treatment, but it should stay short and credible.",
  ],
  overlayTextLimits: {
    low: "No more than 5-7 words in the main overlay.",
    medium:
      "Up to 12-16 words when the format allows a secondary supporting line.",
  },
  formatNotes: {
    square: "Best for balanced focal point and short overlay text.",
    portrait: "Works for mobile-first layouts with vertical hierarchy.",
    landscape:
      "Use for email hero, landing hero, or export previews with wider breathing room.",
    story: "Use a strong top hook, central visual, and bottom action zone.",
    custom:
      "Preserve hierarchy and brand spacing even when the aspect ratio changes.",
  } satisfies Record<CreativeAssetFormat, string>,
  inheritedVisualRules: VISUAL_RULES,
};

export function buildVisualGuardrails() {
  return {
    palette: BRAND_VISUAL_GUARDS.inheritedVisualRules.palette,
    typography: BRAND_VISUAL_GUARDS.inheritedVisualRules.typography,
    artDirection: BRAND_VISUAL_GUARDS.inheritedVisualRules.artDirection,
    iconography: BRAND_VISUAL_GUARDS.inheritedVisualRules.iconography,
    principles: BRAND_VISUAL_GUARDS.principles,
    doList: BRAND_VISUAL_GUARDS.doList,
    dontList: BRAND_VISUAL_GUARDS.dontList,
    compositionPatterns: BRAND_VISUAL_GUARDS.compositionPatterns,
    copyToVisualRules: BRAND_VISUAL_GUARDS.copyToVisualRules,
    overlayTextLimits: BRAND_VISUAL_GUARDS.overlayTextLimits,
  };
}
