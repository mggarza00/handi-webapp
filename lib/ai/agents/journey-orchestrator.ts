import type { CampaignGenerationInput, JourneyStep } from "@/lib/ai/schemas";
import { DEFAULT_FORMAT_BY_CHANNEL } from "@/lib/ai/schemas";

export type JourneyOrchestratorInput = CampaignGenerationInput;

function timingForStep(index: number): string {
  if (index === 0) return "Immediate";
  if (index === 1) return "Within 24 hours";
  if (index === 2) return "Within 3 days";
  return `Step ${index + 1} follow-up window`;
}

function purposeForChannel(channel: JourneyStep["channel"]): string {
  if (channel === "meta") return "Create awareness and capture intent.";
  if (channel === "email") return "Explain the offer with trust and detail.";
  if (channel === "whatsapp") return "Nudge with a helpful, human follow-up.";
  if (channel === "push") return "Prompt a timely return action.";
  return "Convert interest into confidence and action.";
}

export function runJourneyOrchestrator(
  input: JourneyOrchestratorInput,
): JourneyStep[] {
  return input.channels.map((channel, index) => ({
    step: index + 1,
    channel,
    purpose: purposeForChannel(channel),
    timing: timingForStep(index),
    format: DEFAULT_FORMAT_BY_CHANNEL[channel],
    trigger:
      index === 0
        ? input.journeyTrigger
        : `${input.journeyTrigger} -> follow-up ${index}`,
  }));
}
