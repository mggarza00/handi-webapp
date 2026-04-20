import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import type {
  CampaignDraftRow,
  CampaignMessageView,
  CampaignPublishMode,
  CampaignPublishStatus,
  PublishChannel,
} from "@/lib/campaigns/workflow";
import type {
  CampaignPerformanceEventInput,
  CampaignPerformanceMetricInput,
} from "@/lib/campaigns/analytics";

export type PublishAdminClient = SupabaseClient<Database>;

export type PublishTargeting = {
  targetEmails: string[];
  targetUserIds: string[];
  targetPhone: string | null;
};

export type PublishConnectorInput = {
  admin: PublishAdminClient;
  campaign: CampaignDraftRow;
  message: CampaignMessageView | null;
  publishJobId: string;
  channel: PublishChannel;
  mode: CampaignPublishMode;
  targeting: PublishTargeting;
};

export type PublishConnectorAnalyticsSnapshot = {
  metrics?: CampaignPerformanceMetricInput[];
  events?: CampaignPerformanceEventInput[];
};

export type PublishConnectorResult = {
  publishStatus: Extract<CampaignPublishStatus, "published" | "publish_failed">;
  publishMode: CampaignPublishMode;
  providerName: string;
  providerResponseSummary: string;
  payload: Record<string, unknown>;
  externalReferenceId: string | null;
  errorMessage: string | null;
  analyticsSnapshot?: PublishConnectorAnalyticsSnapshot | null;
};

export type PublishConnectorDefinition = {
  channel: PublishChannel;
  label: string;
  supportedModes: CampaignPublishMode[];
  defaultMode: CampaignPublishMode;
  capability: "live" | "draft" | "export";
  description: string;
  execute: (input: PublishConnectorInput) => Promise<PublishConnectorResult>;
};
