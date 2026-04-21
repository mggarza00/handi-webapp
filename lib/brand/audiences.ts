import type { AudienceType } from "@/lib/ai/schemas";

export type AudienceProfile = {
  key: AudienceType;
  label: string;
  summary: string;
  jobsToBeDone: string[];
  trustTriggers: string[];
  objections: string[];
  contentNeeds: string[];
};

export const AUDIENCE_SEGMENTS: Record<AudienceType, AudienceProfile> = {
  client: {
    key: "client",
    label: "Clients / Users",
    summary:
      "Busy people looking for trusted help to solve home or office tasks without extra friction.",
    jobsToBeDone: [
      "Find a trustworthy pro fast.",
      "Understand the service process clearly.",
      "Feel safe before paying or moving forward.",
    ],
    trustTriggers: [
      "Clear process and next step.",
      "Signals of professionalism and safety.",
      "Language that reduces uncertainty instead of adding hype.",
    ],
    objections: [
      "Fear of bad quality or unreliable pros.",
      "Concern about wasting time.",
      "Low confidence in generic marketplace claims.",
    ],
    contentNeeds: [
      "Confidence-building education.",
      "Simple service explanations.",
      "Proof that the workflow is practical and safe.",
    ],
  },
  professional: {
    key: "professional",
    label: "Professionals",
    summary:
      "Independent pros and operators who want serious opportunities, stronger visibility, and a more professional workflow.",
    jobsToBeDone: [
      "Get quality leads.",
      "Present work in a more professional way.",
      "Reduce friction in communication and follow-up.",
    ],
    trustTriggers: [
      "Respectful language about their craft.",
      "Clear value around visibility and workflow.",
      "Signals that the platform attracts serious clients.",
    ],
    objections: [
      "Fear of low-quality leads.",
      "Fear of hidden friction or wasted time.",
      "Skepticism toward exaggerated growth promises.",
    ],
    contentNeeds: [
      "Professional growth messaging.",
      "Clear feature-to-value explanations.",
      "Proof that Handi supports trust on both sides.",
    ],
  },
  business: {
    key: "business",
    label: "Businesses / SMEs",
    summary:
      "Teams that need reliable service coordination, trusted vendors, and less operational chaos.",
    jobsToBeDone: [
      "Centralize service needs with less coordination pain.",
      "Work with reliable providers.",
      "Create repeatable service processes.",
    ],
    trustTriggers: [
      "Operational clarity.",
      "Reliable provider language.",
      "Process, accountability, and consistency.",
    ],
    objections: [
      "Fear of vendor inconsistency.",
      "Concern around coordination overhead.",
      "Distrust of consumer-style hype in B2B contexts.",
    ],
    contentNeeds: [
      "Operational efficiency messaging.",
      "Vendor trust messaging.",
      "Proof-oriented service narratives.",
    ],
  },
};

export const AUDIENCE_ORDER: AudienceType[] = [
  "client",
  "professional",
  "business",
];
