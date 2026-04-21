import type { AudienceType } from "@/lib/ai/schemas";
import { AUDIENCE_SEGMENTS } from "@/lib/brand/audiences";

export type SegmenterInput = {
  audience: AudienceType;
  notes?: string;
  journeyTrigger?: string;
};

export type StandardizedSegment = {
  audience: AudienceType;
  label: string;
  journeyStage: "discover" | "consider" | "convert" | "retain";
  summary: string;
  trustTriggers: string[];
  objections: string[];
  recommendedPillars: string[];
};

function inferJourneyStage(
  notes: string,
  journeyTrigger?: string,
): StandardizedSegment["journeyStage"] {
  const source = `${journeyTrigger || ""} ${notes}`.toLowerCase();
  if (/(reactivat|return|winback|inactive)/.test(source)) return "retain";
  if (/(book|start|pay|quote|lead|signup|apply|register)/.test(source)) {
    return "convert";
  }
  if (/(compare|explore|learn|consider|research)/.test(source)) {
    return "consider";
  }
  return "discover";
}

export function runSegmenter(input: SegmenterInput): StandardizedSegment {
  const audience = AUDIENCE_SEGMENTS[input.audience];
  return {
    audience: input.audience,
    label: audience.label,
    journeyStage: inferJourneyStage(input.notes || "", input.journeyTrigger),
    summary: audience.summary,
    trustTriggers: audience.trustTriggers,
    objections: audience.objections,
    recommendedPillars: audience.contentNeeds,
  };
}
