import type { StandardizedSegment } from "@/lib/ai/agents/segmenter";
import {
  generateCampaignDraftWithProvider,
  generateContentVariantsWithProvider,
  regenerateContentVariantWithProvider,
  type AiProviderInfo,
} from "@/lib/ai/provider";
import { buildBrandContext } from "@/lib/ai/prompts/brand-master";
import { DEFAULT_FORMAT_BY_CHANNEL } from "@/lib/ai/schemas";
import type {
  BrandContext,
  CampaignGenerationInput,
  ContentGenerationInput,
  GeneratedMessage,
  JourneyStep,
  KpiSuggestion,
} from "@/lib/ai/schemas";
import { runAgent } from "@/lib/ai/run-agent";
import {
  buildCampaignTitle,
  parseMessageRationale,
  serializeMessageRationale,
  type CampaignMessageContent,
} from "@/lib/campaigns/workflow";

export type GeneratedCampaignProposal = {
  title: string;
  provider: AiProviderInfo;
  brandContext: BrandContext;
  segment: StandardizedSegment;
  rationaleSummary: string;
  recommendedAngle: string;
  guardrailsApplied: string[];
  channelPlan: JourneyStep[];
  messageSuggestions: GeneratedMessage[];
  kpiSuggestions: KpiSuggestion[];
};

export type GeneratedContentProposal = {
  title: string;
  provider: AiProviderInfo;
  brandContext: BrandContext;
  segment: StandardizedSegment;
  rationaleSummary: string;
  recommendedAngle: string;
  guardrailsApplied: string[];
  channelPlan: JourneyStep[];
  kpiSuggestions: KpiSuggestion[];
  variants: GeneratedMessage[];
};

function buildRationaleSummary(args: {
  audienceLabel: string;
  goal: string;
  angle: string;
  channels: string[];
  primaryObjection?: string;
  cta: string;
}): string {
  const objection = args.primaryObjection
    ? ` Atiende la objecion principal: ${args.primaryObjection}.`
    : "";

  return `Se eligio el angulo "${args.angle}" para ${args.audienceLabel} con objetivo de ${args.goal}. La mezcla de canales ${args.channels.join(", ")} sostiene ese recorrido y el CTA "${args.cta}" deja una siguiente accion clara.${objection}`;
}

function buildEffectiveNotes(args: {
  notes?: string;
  tonePreference?: string;
}) {
  return [args.notes?.trim(), args.tonePreference?.trim()]
    .filter(Boolean)
    .map((value, index) =>
      index === 1 ? `Tone preference: ${value as string}` : (value as string),
    )
    .join("\n");
}

function buildChannelReason(channel: GeneratedMessage["channel"]): string {
  if (channel === "meta") {
    return "It creates first attention quickly and lets Handi lead with trust before asking for action.";
  }
  if (channel === "email") {
    return "It gives more room to explain the value clearly and reduce uncertainty before the next step.";
  }
  if (channel === "whatsapp") {
    return "It feels direct and useful for follow-up moments where speed and clarity matter.";
  }
  if (channel === "push") {
    return "It works for timely reminders where the message must stay short, clear, and low friction.";
  }
  return "It supports conversion by expanding trust, proof, and next steps on one page.";
}

function enrichMessageRationale(
  message: GeneratedMessage,
  segment: StandardizedSegment,
  cta: string,
): GeneratedMessage {
  const parsed = parseMessageRationale(message.rationale);

  return {
    ...message,
    rationale: serializeMessageRationale({
      angle: parsed.angle || message.angle,
      audienceIntent:
        parsed.audienceIntent ||
        `Move ${segment.label} through ${segment.journeyStage} while answering ${segment.objections[0] || "the need for clarity and confidence"}.`,
      whyChannel: parsed.whyChannel || buildChannelReason(message.channel),
      whyCta:
        parsed.whyCta ||
        `The CTA "${cta}" keeps the next step concrete and low risk.`,
      note: parsed.note,
      summary: parsed.summary || message.rationale,
    }),
  };
}

function defaultProviderInfo(): AiProviderInfo {
  return {
    requestedProvider: "mock",
    activeProvider: "mock",
    status: "ready",
    generationMode: "mock",
    model: null,
    note: "Using deterministic mock provider.",
    generatedAt: new Date().toISOString(),
    fallbackReason: null,
    requestId: null,
  };
}

export async function generateCampaignProposal(
  input: CampaignGenerationInput,
): Promise<GeneratedCampaignProposal> {
  const effectiveNotes = buildEffectiveNotes({
    notes: input.notes,
    tonePreference: input.tonePreference,
  });
  const segment = await runAgent("segmenter", {
    audience: input.audience,
    notes: effectiveNotes,
    journeyTrigger: input.journeyTrigger,
  });
  const supervisorPlan = await runAgent("supervisor", {
    mode: "campaign",
    ...input,
    notes: effectiveNotes,
  });
  const channelPlan = await runAgent("journey-orchestrator", input);
  const brandContext = buildBrandContext({
    audience: input.audience,
    goal: input.goal,
    serviceCategory: input.serviceCategory,
    offer: input.offer,
    cta: input.cta,
    channel: input.channels[0] ?? null,
  });

  const providerDraft = await generateCampaignDraftWithProvider({
    items: input.channels.map((channel) => ({
      input: {
        audience: input.audience,
        goal: input.goal,
        channel,
        format: DEFAULT_FORMAT_BY_CHANNEL[channel],
        serviceCategory: input.serviceCategory,
        offer: input.offer,
        cta: input.cta,
        notes: effectiveNotes,
        title: input.title,
        tonePreference: input.tonePreference,
      },
      brandContext: buildBrandContext({
        audience: input.audience,
        goal: input.goal,
        serviceCategory: input.serviceCategory,
        offer: input.offer,
        cta: input.cta,
        channel,
      }),
      recommendedAngle: supervisorPlan.recommendedAngle,
    })),
  });

  const messageSuggestions = providerDraft.results.flatMap((result) =>
    result.output.variants.map((variant) =>
      enrichMessageRationale(variant, segment, input.cta),
    ),
  );
  const kpiSuggestions = await runAgent("analyst", {
    ...input,
    notes: effectiveNotes,
    recommendedAngle: supervisorPlan.recommendedAngle,
  });
  const providerAngle =
    providerDraft.results[0]?.output.recommendedAngle?.trim() || "";
  const providerSummary =
    providerDraft.results[0]?.output.rationaleSummary?.trim() || "";

  return {
    title: buildCampaignTitle({
      goal: input.goal,
      serviceCategory: input.serviceCategory,
      audience: input.audience,
      title: input.title,
    }),
    provider: providerDraft.provider || defaultProviderInfo(),
    brandContext,
    segment,
    rationaleSummary:
      providerSummary ||
      buildRationaleSummary({
        audienceLabel: segment.label,
        goal: input.goal,
        angle: providerAngle || supervisorPlan.recommendedAngle,
        channels: input.channels,
        primaryObjection: segment.objections[0],
        cta: input.cta,
      }),
    recommendedAngle: providerAngle || supervisorPlan.recommendedAngle,
    guardrailsApplied: supervisorPlan.guardrailsApplied,
    channelPlan,
    messageSuggestions,
    kpiSuggestions,
  };
}

export async function generateContentProposal(
  input: ContentGenerationInput,
  context?: {
    previousMessage?: CampaignMessageContent | null;
    previousRationale?: string | null;
    feedbackNote?: string | null;
  },
): Promise<GeneratedContentProposal> {
  const effectiveNotes = buildEffectiveNotes({
    notes: input.notes,
    tonePreference: input.tonePreference,
  });
  const segment = await runAgent("segmenter", {
    audience: input.audience,
    notes: effectiveNotes,
  });
  const supervisorPlan = await runAgent("supervisor", {
    mode: "content",
    ...input,
    notes: effectiveNotes,
  });
  const brandContext = buildBrandContext({
    audience: input.audience,
    goal: input.goal,
    serviceCategory: input.serviceCategory,
    offer: input.offer,
    cta: input.cta,
    channel: input.channel,
  });
  const providerInput = {
    input: { ...input, notes: effectiveNotes },
    brandContext,
    recommendedAngle: supervisorPlan.recommendedAngle,
    previousMessage: context?.previousMessage || null,
    previousRationale: context?.previousRationale || null,
    feedbackNote: context?.feedbackNote || null,
  };
  const writer =
    context?.previousMessage || context?.feedbackNote
      ? await regenerateContentVariantWithProvider(providerInput)
      : await generateContentVariantsWithProvider(providerInput);
  const channelPlan = [
    {
      step: 1,
      channel: input.channel,
      purpose: "Single-channel content proposal for admin review.",
      timing: "Immediate",
      format: input.format,
      trigger: "manual_generation",
    },
  ] as JourneyStep[];
  const kpiSuggestions = await runAgent("analyst", {
    audience: input.audience,
    goal: input.goal,
    channels: [input.channel],
    serviceCategory: input.serviceCategory,
    offer: input.offer,
    cta: input.cta,
    journeyTrigger: "manual_generation",
    notes: input.notes,
    title: input.title,
    tonePreference: input.tonePreference,
    recommendedAngle: supervisorPlan.recommendedAngle,
  });
  const providerAngle = writer.recommendedAngle?.trim() || "";
  const providerSummary = writer.rationaleSummary?.trim() || "";

  return {
    title: buildCampaignTitle({
      goal: input.goal,
      serviceCategory: input.serviceCategory,
      audience: input.audience,
      title: input.title,
    }),
    provider: writer.provider,
    brandContext,
    segment,
    rationaleSummary:
      providerSummary ||
      buildRationaleSummary({
        audienceLabel: segment.label,
        goal: input.goal,
        angle: providerAngle || supervisorPlan.recommendedAngle,
        channels: [input.channel],
        primaryObjection: segment.objections[0],
        cta: input.cta,
      }),
    recommendedAngle: providerAngle || supervisorPlan.recommendedAngle,
    guardrailsApplied: supervisorPlan.guardrailsApplied,
    channelPlan,
    kpiSuggestions,
    variants: writer.variants.map((variant) =>
      enrichMessageRationale(variant, segment, input.cta),
    ),
  };
}
