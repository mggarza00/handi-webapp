import type {
  CampaignGenerationInput,
  ChannelType,
  ContentFormat,
  ContentGenerationInput,
} from "@/lib/ai/schemas";
import { DEFAULT_FORMAT_BY_CHANNEL } from "@/lib/ai/schemas";
import { getChannelGuardrails } from "@/lib/brand/channel-rules";

export type SupervisorInput =
  | ({ mode: "content" } & ContentGenerationInput)
  | ({ mode: "campaign" } & CampaignGenerationInput);

export type SupervisorPlan = {
  recommendedAngle: string;
  deliverables: Array<{
    channel: ChannelType;
    format: ContentFormat;
    purpose: string;
  }>;
  guardrailsApplied: string[];
};

function pickRecommendedAngle(input: SupervisorInput): string {
  const audiencePrefix =
    input.audience === "client"
      ? "Trust and relief"
      : input.audience === "professional"
        ? "Serious opportunities"
        : "Operational reliability";

  const goalFrame =
    input.goal === "awareness"
      ? "introduce Handi with clarity"
      : input.goal === "acquisition"
        ? "turn interest into qualified intent"
        : input.goal === "activation"
          ? "move the audience into first action"
          : input.goal === "conversion"
            ? "help the audience commit with confidence"
            : input.goal === "retention"
              ? "keep Handi top of mind"
              : input.goal === "reactivation"
                ? "bring the audience back with a credible reason"
                : input.goal === "upsell"
                  ? "expand usage without sounding pushy"
                  : input.goal === "referral"
                    ? "turn trust into advocacy"
                    : "educate while reducing uncertainty";

  return `${audiencePrefix} for ${input.serviceCategory}: ${goalFrame} using ${input.offer}.`;
}

function getChannels(input: SupervisorInput): ChannelType[] {
  return input.mode === "content" ? [input.channel] : input.channels;
}

export function runSupervisor(input: SupervisorInput): SupervisorPlan {
  const channels = getChannels(input);
  const deliverables = channels.map((channel) => ({
    channel,
    format:
      input.mode === "content" && channel === input.channel
        ? input.format
        : DEFAULT_FORMAT_BY_CHANNEL[channel],
    purpose:
      channel === "meta"
        ? "Drive attention and interest."
        : channel === "email"
          ? "Explain value with more context."
          : channel === "whatsapp"
            ? "Create a helpful follow-up touchpoint."
            : channel === "push"
              ? "Trigger a timely action."
              : "Turn campaign interest into trust and action.",
  }));

  return {
    recommendedAngle: pickRecommendedAngle(input),
    deliverables,
    guardrailsApplied: Array.from(
      new Set(channels.flatMap((channel) => getChannelGuardrails(channel))),
    ),
  };
}
