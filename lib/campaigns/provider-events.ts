import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ingestCampaignAnalytics,
  type CampaignPerformanceEventInput,
  type PerformanceChannel,
  type PerformanceEventType,
} from "@/lib/campaigns/analytics";
import { refreshCampaignLearningLoop } from "@/lib/campaigns/analytics-refresh";
import type {
  NormalizedProviderEvent,
  ProviderEventSource,
  ProviderEventStatus,
} from "@/lib/campaigns/event-normalization";
import type { Database } from "@/types/supabase";

type AdminSupabase = SupabaseClient<Database>;

export type CampaignProviderEventRow = {
  id: string;
  provider_name: string;
  provider_event_id: string | null;
  dedupe_key: string;
  event_source: ProviderEventSource;
  provider_event_type: string;
  normalized_event_type: PerformanceEventType | null;
  campaign_draft_id: string | null;
  campaign_message_id: string | null;
  publish_job_id: string | null;
  channel: PerformanceChannel | null;
  target_user_id: string | null;
  target_identifier: string | null;
  event_timestamp: string;
  processed_status: ProviderEventStatus;
  error_message: string | null;
  payload: Record<string, unknown>;
  normalized_metadata: Record<string, unknown>;
  created_at: string;
};

type ProviderEventIngestSummary = {
  inserted: number;
  duplicates: number;
  processed: number;
  ignored: number;
  errors: number;
  affectedCampaignIds: string[];
  campaigns: Array<Awaited<ReturnType<typeof refreshCampaignLearningLoop>>>;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function mapProviderEventRow(
  value: Record<string, unknown>,
): CampaignProviderEventRow {
  return {
    id: readString(value.id),
    provider_name: readString(value.provider_name),
    provider_event_id: readNullableString(value.provider_event_id),
    dedupe_key: readString(value.dedupe_key),
    event_source: readString(value.event_source) as ProviderEventSource,
    provider_event_type: readString(value.provider_event_type),
    normalized_event_type: readNullableString(
      value.normalized_event_type,
    ) as PerformanceEventType | null,
    campaign_draft_id: readNullableString(value.campaign_draft_id),
    campaign_message_id: readNullableString(value.campaign_message_id),
    publish_job_id: readNullableString(value.publish_job_id),
    channel: readNullableString(value.channel) as PerformanceChannel | null,
    target_user_id: readNullableString(value.target_user_id),
    target_identifier: readNullableString(value.target_identifier),
    event_timestamp: readString(value.event_timestamp),
    processed_status: readString(value.processed_status) as ProviderEventStatus,
    error_message: readNullableString(value.error_message),
    payload: readRecord(value.payload),
    normalized_metadata: readRecord(value.normalized_metadata),
    created_at: readString(value.created_at),
  };
}

function buildAnalyticsEventInput(
  event: NormalizedProviderEvent,
): CampaignPerformanceEventInput | null {
  if (
    event.processedStatus !== "processed" ||
    !event.normalizedEventType ||
    !event.campaignDraftId ||
    !event.publishJobId ||
    !event.channel
  ) {
    return null;
  }

  return {
    campaignDraftId: event.campaignDraftId,
    campaignMessageId: event.campaignMessageId || undefined,
    publishJobId: event.publishJobId,
    channel: event.channel,
    eventType: event.normalizedEventType,
    count: 1,
    targetUserId: event.targetUserId || undefined,
    targetIdentifier: event.targetIdentifier || undefined,
    source: event.analyticsSource,
    metadata: {
      providerName: event.providerName,
      providerEventType: event.providerEventType,
      providerEventId: event.providerEventId,
      eventSource: event.eventSource,
      ...event.normalizedMetadata,
    },
    occurredAt: event.eventTimestamp,
  };
}

async function insertProviderEvent(
  admin: AdminSupabase,
  event: NormalizedProviderEvent,
) {
  const { data, error } = await admin
    .from("campaign_provider_events")
    .insert({
      provider_name: event.providerName,
      provider_event_id: event.providerEventId,
      dedupe_key: event.dedupeKey,
      event_source: event.eventSource,
      provider_event_type: event.providerEventType,
      normalized_event_type: event.normalizedEventType,
      campaign_draft_id: event.campaignDraftId,
      campaign_message_id: event.campaignMessageId,
      publish_job_id: event.publishJobId,
      channel: event.channel,
      target_user_id: event.targetUserId,
      target_identifier: event.targetIdentifier,
      event_timestamp: event.eventTimestamp,
      processed_status: event.processedStatus,
      error_message: event.errorMessage,
      payload: event.payload,
      normalized_metadata: {
        ...event.normalizedMetadata,
        analyticsSource: event.analyticsSource,
      },
    } as never)
    .select("*")
    .single();

  if (error) {
    const duplicate =
      error.code === "23505" ||
      /duplicate key|unique constraint/i.test(error.message || "");
    if (duplicate) {
      return { duplicate: true, row: null };
    }
    throw new Error(error.message || "failed to persist provider event");
  }

  return {
    duplicate: false,
    row: data ? mapProviderEventRow(data as Record<string, unknown>) : null,
  };
}

export async function listCampaignProviderEvents(
  admin: AdminSupabase,
  campaignIds: string[],
) {
  const ids = Array.from(
    new Set(campaignIds.filter((value) => typeof value === "string" && value)),
  );
  if (!ids.length) return [] as CampaignProviderEventRow[];

  const { data, error } = await admin
    .from("campaign_provider_events")
    .select("*")
    .in("campaign_draft_id", ids)
    .order("event_timestamp", { ascending: false });

  if (error) {
    throw new Error(error.message || "failed to load provider events");
  }

  return (Array.isArray(data) ? data : []).map((row) =>
    mapProviderEventRow(row as Record<string, unknown>),
  );
}

export async function processProviderEvents(input: {
  admin: AdminSupabase;
  events: NormalizedProviderEvent[];
  actorId?: string | null;
  note?: string | null;
}): Promise<ProviderEventIngestSummary> {
  const acceptedEvents: NormalizedProviderEvent[] = [];
  let duplicates = 0;
  let ignored = 0;
  let errors = 0;

  for (const event of input.events) {
    const inserted = await insertProviderEvent(input.admin, event);
    if (inserted.duplicate) {
      duplicates += 1;
      continue;
    }

    if (event.processedStatus === "processed") {
      acceptedEvents.push(event);
    } else if (event.processedStatus === "ignored") {
      ignored += 1;
    } else {
      errors += 1;
    }
  }

  const analyticsEvents = acceptedEvents
    .map((event) => buildAnalyticsEventInput(event))
    .filter((event): event is CampaignPerformanceEventInput => Boolean(event));

  let campaigns: Array<
    Awaited<ReturnType<typeof refreshCampaignLearningLoop>>
  > = [];
  if (analyticsEvents.length) {
    const ingest = await ingestCampaignAnalytics(input.admin, {
      events: analyticsEvents,
    });
    campaigns = await Promise.all(
      ingest.affectedCampaignIds.map((campaignId) =>
        refreshCampaignLearningLoop({
          admin: input.admin,
          campaignId,
          actorId: input.actorId || null,
          metricsIngested: ingest.metricsIngested,
          eventsIngested: ingest.eventsIngested,
          metricSources: ingest.metricSources,
          eventSources: ingest.eventSources,
          note:
            input.note ||
            `Ingested ${ingest.eventsIngested} live callback event(s) from ${ingest.eventSources.join(", ")}.`,
        }),
      ),
    );
  }

  return {
    inserted: input.events.length - duplicates,
    duplicates,
    processed: analyticsEvents.length,
    ignored,
    errors,
    affectedCampaignIds: Array.from(
      new Set(campaigns.map((campaign) => campaign.campaignId).filter(Boolean)),
    ),
    campaigns,
  };
}
