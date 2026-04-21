import {
  buildCreativeBrief,
  type CreativeBriefInput,
} from "@/lib/creative/brief";
import {
  getCreativeProvider,
  type CreativeProviderName,
} from "@/lib/creative/provider";

export async function generateCreativeImageProposal(
  input: CreativeBriefInput,
  providerOverride?: CreativeProviderName,
) {
  const brief = buildCreativeBrief(input);
  const provider = getCreativeProvider(providerOverride);
  const output = await provider.generateImageAssets({
    brief,
  });

  return {
    brief,
    provider: output.provider,
    briefSummary: output.briefSummary,
    rationaleSummary: output.rationaleSummary,
    variants: output.variants,
  };
}

export async function regenerateCreativeImageProposal(args: {
  input: CreativeBriefInput;
  previousPrompt: string;
  previousRationale: string;
  feedbackNote?: string | null;
  providerOverride?: CreativeProviderName;
}) {
  const brief = buildCreativeBrief(args.input);
  const provider = getCreativeProvider(args.providerOverride);
  const output = await provider.regenerateImageAsset({
    brief,
    previousPrompt: args.previousPrompt,
    previousRationale: args.previousRationale,
    feedbackNote: args.feedbackNote,
  });

  return {
    brief,
    provider: output.provider,
    briefSummary: output.briefSummary,
    rationaleSummary: output.rationaleSummary,
    variants: output.variants,
  };
}
