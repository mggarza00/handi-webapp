import { labelChannel, type PublishChannel } from "@/lib/campaigns/workflow";
import { emailPublishConnector } from "@/lib/publish/channels/email";
import { googlePublishConnector } from "@/lib/publish/channels/google";
import { landingPublishConnector } from "@/lib/publish/channels/landing";
import { metaPublishConnector } from "@/lib/publish/channels/meta";
import { pushPublishConnector } from "@/lib/publish/channels/push";
import { whatsappPublishConnector } from "@/lib/publish/channels/whatsapp";
import type {
  PublishConnectorDefinition,
  PublishConnectorInput,
  PublishConnectorResult,
} from "@/lib/publish/types";
import type { ChannelType } from "@/lib/ai/schemas";

const CONNECTORS: Record<PublishChannel, PublishConnectorDefinition> = {
  email: emailPublishConnector,
  push: pushPublishConnector,
  whatsapp: whatsappPublishConnector,
  meta: metaPublishConnector,
  landing: landingPublishConnector,
  google: googlePublishConnector,
};

export function getPublishConnector(channel: PublishChannel) {
  return CONNECTORS[channel];
}

export async function executePublishConnector(
  input: PublishConnectorInput,
): Promise<PublishConnectorResult> {
  const connector = getPublishConnector(input.channel);
  if (!connector) {
    throw new Error(`Unsupported publish channel: ${input.channel}`);
  }
  return connector.execute(input);
}

export function getPublishableChannels(
  campaignChannels: ChannelType[],
): PublishConnectorDefinition[] {
  const base = campaignChannels.map((channel) => CONNECTORS[channel]);

  if (
    campaignChannels.includes("meta") ||
    campaignChannels.includes("landing")
  ) {
    base.push(CONNECTORS.google);
  }

  return Array.from(
    new Map(base.map((connector) => [connector.channel, connector])).values(),
  );
}

export function labelPublishChannel(channel: PublishChannel): string {
  return channel === "google" ? "Google ads" : labelChannel(channel);
}
