import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  channelTypes,
  type AudienceType,
  type CampaignGoal,
} from "@/lib/ai/schemas";
import type { CampaignProviderEventRow } from "@/lib/campaigns/provider-events";
import type { Database } from "@/types/supabase";
import type {
  CampaignPublishJobRow,
  CampaignPublishStatus,
  CampaignWorkflowStatus,
  PublishChannel,
} from "@/lib/campaigns/workflow";
import { labelChannel, normalizePublishStatus } from "@/lib/campaigns/workflow";

type AdminSupabase = SupabaseClient<Database>;

export const performanceChannels = [...channelTypes, "google"] as const;
export const performanceEventTypes = [
  "delivered",
  "opened",
  "clicked",
  "engaged",
  "converted",
  "failed",
  "replied",
] as const;

export type PerformanceChannel = (typeof performanceChannels)[number];
export type PerformanceEventType = (typeof performanceEventTypes)[number];

export type PerformanceCounts = {
  impressions: number;
  clicks: number;
  opens: number;
  replies: number;
  deliveries: number;
  conversions: number;
  failures: number;
  spend: number | null;
  revenue: number | null;
};

export type DerivedPerformanceRates = {
  ctr: number | null;
  open_rate: number | null;
  click_to_open_rate: number | null;
  conversion_rate: number | null;
  delivery_rate: number | null;
  failure_rate: number | null;
};

export type PerformanceSummary = PerformanceCounts &
  DerivedPerformanceRates & {
    recorded_at: string | null;
    sources: string[];
  };

export type MetricDelta = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  direction: "up" | "down" | "flat";
};

export type PerformanceComparison = {
  current: PerformanceSummary;
  previous: PerformanceSummary;
  range: {
    current_from: string;
    current_to: string;
    previous_from: string;
    previous_to: string;
  };
  deltas: {
    deliveries: MetricDelta;
    opens: MetricDelta;
    clicks: MetricDelta;
    conversions: MetricDelta;
    failures: MetricDelta;
    ctr: MetricDelta;
    open_rate: MetricDelta;
    conversion_rate: MetricDelta;
  };
};

export type TrendPoint = {
  bucket: string;
  deliveries: number;
  opens: number;
  clicks: number;
  conversions: number;
  failures: number;
  ctr: number | null;
  open_rate: number | null;
  conversion_rate: number | null;
};

export type TrendSeries = {
  id: string;
  label: string;
  direction: "up" | "down" | "flat";
  summary: string;
  points: TrendPoint[];
};

export const performanceSignalQualities = [
  "live",
  "mixed",
  "manual",
  "limited",
] as const;

export type PerformanceSignalQuality =
  (typeof performanceSignalQualities)[number];

export type SignalSummary = {
  signal_quality: PerformanceSignalQuality;
  sources: string[];
  last_callback_at: string | null;
  last_sync_error_at: string | null;
  last_sync_error_message: string | null;
  automated_event_count: number;
  manual_source_count: number;
  error_count: number;
};

export type CampaignPerformanceMetricRow = PerformanceSummary & {
  id: string;
  campaign_draft_id: string;
  campaign_message_id: string | null;
  publish_job_id: string | null;
  channel: PerformanceChannel;
  source: string;
};

export type CampaignPerformanceEventRow = {
  id: string;
  campaign_draft_id: string;
  campaign_message_id: string | null;
  publish_job_id: string | null;
  channel: PerformanceChannel;
  event_type: PerformanceEventType;
  event_count: number;
  target_user_id: string | null;
  target_identifier: string | null;
  source: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export type ChannelPerformanceSummary = PerformanceSummary & {
  channel: PerformanceChannel;
} & SignalSummary;

export type MessagePerformanceSummary = PerformanceSummary & {
  campaign_draft_id: string;
  message_id: string;
  channel: PerformanceChannel;
  variant_name: string;
  status: CampaignWorkflowStatus;
  qa_score: number;
} & SignalSummary;

export type PublishJobPerformanceSummary = PerformanceSummary & {
  job_id: string;
  campaign_draft_id: string;
  campaign_title: string;
  channel: PublishChannel;
  publish_status: CampaignPublishStatus;
  publish_mode: CampaignPublishJobRow["publish_mode"];
  provider_name: string;
  triggered_at: string;
  completed_at: string | null;
  message_id: string | null;
  message_variant_name: string | null;
} & SignalSummary;

export type CampaignAnalyticsCampaignRow = {
  id: string;
  title: string;
  audience: AudienceType;
  goal: CampaignGoal;
  status: CampaignWorkflowStatus;
  publish_status: CampaignPublishStatus;
  updated_at: string;
  qa_score: number;
  channel_count: number;
  publish_job_count: number;
  summary: PerformanceSummary;
  signal_summary: SignalSummary;
};

export type CampaignAnalyticsDetail = {
  summary: PerformanceSummary;
  signal_summary: SignalSummary;
  comparison: PerformanceComparison;
  channel_breakdown: ChannelPerformanceSummary[];
  message_breakdown: MessagePerformanceSummary[];
  publish_job_breakdown: PublishJobPerformanceSummary[];
  campaign_trend: TrendSeries;
  channel_trends: TrendSeries[];
  message_trends: TrendSeries[];
  publish_job_trend: TrendSeries;
  recent_events: CampaignPerformanceEventRow[];
};

export type CampaignAnalyticsDashboard = {
  totals: PerformanceSummary & {
    campaign_count: number;
    published_campaign_count: number;
    publish_job_count: number;
  };
  signal_overview: SignalSummary;
  comparison: PerformanceComparison;
  channel_breakdown: ChannelPerformanceSummary[];
  campaign_rows: CampaignAnalyticsCampaignRow[];
  top_messages: MessagePerformanceSummary[];
  recent_publish_jobs: PublishJobPerformanceSummary[];
  campaign_trends: TrendSeries[];
  channel_trends: TrendSeries[];
  publish_job_trend: TrendSeries;
  recent_events: CampaignPerformanceEventRow[];
};

type AnalyticsCampaignBaseRow = {
  id: string;
  title: string;
  audience: AudienceType;
  goal: CampaignGoal;
  status: CampaignWorkflowStatus;
  publish_status: CampaignPublishStatus;
  updated_at: string;
  channels: PerformanceChannel[];
  qa_score: number;
};

type AnalyticsMessageBaseRow = {
  id: string;
  campaign_draft_id: string;
  channel: PerformanceChannel;
  variant_name: string;
  status: CampaignWorkflowStatus;
  qa_score: number;
};

type AnalyticsFilters = {
  from?: string | null;
  to?: string | null;
  channel?: PerformanceChannel | "";
  status?: CampaignWorkflowStatus | "";
  audience?: AudienceType | "";
  goal?: CampaignGoal | "";
  campaignId?: string | null;
  campaignIds?: string[];
};

type AnalyticsRange = {
  currentFrom: string;
  currentTo: string;
  previousFrom: string;
  previousTo: string;
};

const performanceChannelSchema = z.enum(performanceChannels);
const performanceEventTypeSchema = z.enum(performanceEventTypes);

export const performanceMetricInputSchema = z.object({
  campaignDraftId: z.string().uuid(),
  campaignMessageId: z.string().uuid().optional(),
  publishJobId: z.string().uuid().optional(),
  channel: performanceChannelSchema,
  impressions: z.coerce.number().int().min(0).optional().default(0),
  clicks: z.coerce.number().int().min(0).optional().default(0),
  opens: z.coerce.number().int().min(0).optional().default(0),
  replies: z.coerce.number().int().min(0).optional().default(0),
  deliveries: z.coerce.number().int().min(0).optional().default(0),
  conversions: z.coerce.number().int().min(0).optional().default(0),
  failures: z.coerce.number().int().min(0).optional().default(0),
  spend: z.coerce.number().min(0).nullable().optional().default(null),
  revenue: z.coerce.number().min(0).nullable().optional().default(null),
  recordedAt: z.string().datetime().optional(),
  source: z.string().trim().min(1).max(80).optional().default("manual"),
});

export const performanceEventInputSchema = z.object({
  campaignDraftId: z.string().uuid(),
  campaignMessageId: z.string().uuid().optional(),
  publishJobId: z.string().uuid().optional(),
  channel: performanceChannelSchema,
  eventType: performanceEventTypeSchema,
  count: z.coerce.number().int().min(1).optional().default(1),
  targetUserId: z.string().trim().min(1).max(128).optional(),
  targetIdentifier: z.string().trim().min(1).max(255).optional(),
  source: z.string().trim().min(1).max(80).optional().default("manual"),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  occurredAt: z.string().datetime().optional(),
});

export const analyticsIngestSchema = z.object({
  metrics: z.array(performanceMetricInputSchema).optional().default([]),
  events: z.array(performanceEventInputSchema).optional().default([]),
});

export type CampaignPerformanceMetricInput = z.infer<
  typeof performanceMetricInputSchema
>;
export type CampaignPerformanceEventInput = z.infer<
  typeof performanceEventInputSchema
>;

type PerformanceGroup = {
  key: string;
  campaign_draft_id: string;
  campaign_message_id: string | null;
  publish_job_id: string | null;
  channel: PerformanceChannel;
  summary: PerformanceSummary;
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

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampNonNegativeInt(value: number) {
  return Math.max(0, Math.round(value));
}

function normalizeTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function pickLatestTimestamp(left?: string | null, right?: string | null) {
  if (!left) return right || null;
  if (!right) return left || null;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isManualLikeSource(source: string) {
  return /manual|snapshot|export|publish_connector|dispatch/i.test(source);
}

function buildSignalSummary(args: {
  summary: PerformanceSummary;
  providerEvents: CampaignProviderEventRow[];
}): SignalSummary {
  const liveSources = uniqueStrings(
    args.summary.sources.filter((source) => !isManualLikeSource(source)),
  );
  const manualSources = uniqueStrings(
    args.summary.sources.filter((source) => isManualLikeSource(source)),
  );
  const processedProviderEvents = args.providerEvents.filter(
    (event) => event.processed_status === "processed",
  );
  const callbackSources = uniqueStrings(
    processedProviderEvents.map((event) =>
      typeof event.normalized_metadata.analyticsSource === "string"
        ? String(event.normalized_metadata.analyticsSource)
        : `${event.provider_name}_${event.event_source}`,
    ),
  );
  const reliableSources = uniqueStrings([...liveSources, ...callbackSources]);
  const latestCallback = processedProviderEvents
    .map((event) => event.event_timestamp)
    .filter(Boolean)
    .sort()
    .at(-1);
  const latestError = args.providerEvents
    .filter((event) => event.processed_status === "error")
    .sort((left, right) =>
      left.event_timestamp.localeCompare(right.event_timestamp),
    )
    .at(-1);

  let signalQuality: PerformanceSignalQuality = "limited";
  if (reliableSources.length && manualSources.length) signalQuality = "mixed";
  else if (reliableSources.length) signalQuality = "live";
  else if (manualSources.length) signalQuality = "manual";

  return {
    signal_quality: signalQuality,
    sources: uniqueStrings([...args.summary.sources, ...callbackSources]),
    last_callback_at: latestCallback || null,
    last_sync_error_at: latestError?.event_timestamp || null,
    last_sync_error_message: latestError?.error_message || null,
    automated_event_count: processedProviderEvents.length,
    manual_source_count: manualSources.length,
    error_count: args.providerEvents.filter(
      (event) => event.processed_status === "error",
    ).length,
  };
}

function emptyCounts(): PerformanceCounts {
  return {
    impressions: 0,
    clicks: 0,
    opens: 0,
    replies: 0,
    deliveries: 0,
    conversions: 0,
    failures: 0,
    spend: null,
    revenue: null,
  };
}

function safeRate(numerator: number, denominator: number) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function toUtcDate(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toDayStart(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function dayKey(value: string | null | undefined) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function resolveAnalyticsRange(filters: AnalyticsFilters): AnalyticsRange {
  const now = new Date();
  const fallbackTo = toDayStart(now);
  const parsedFrom = filters.from ? toUtcDate(filters.from) : null;
  const parsedTo = filters.to ? toUtcDate(filters.to) : null;
  const currentTo = parsedTo ? toDayStart(parsedTo) : fallbackTo;
  const currentFrom = parsedFrom
    ? toDayStart(parsedFrom)
    : addDays(currentTo, -6);
  const daySpan = Math.max(
    1,
    Math.round(
      (toDayStart(currentTo).getTime() - toDayStart(currentFrom).getTime()) /
        86_400_000,
    ) + 1,
  );
  const previousTo = addDays(currentFrom, -1);
  const previousFrom = addDays(previousTo, -(daySpan - 1));

  return {
    currentFrom: currentFrom.toISOString(),
    currentTo: addDays(currentTo, 1).toISOString(),
    previousFrom: previousFrom.toISOString(),
    previousTo: addDays(previousTo, 1).toISOString(),
  };
}

function deltaDirection(current: number | null, previous: number | null) {
  const safeCurrent = current ?? 0;
  const safePrevious = previous ?? 0;
  if (safeCurrent > safePrevious) return "up" as const;
  if (safeCurrent < safePrevious) return "down" as const;
  return "flat" as const;
}

function buildMetricDelta(
  current: number | null,
  previous: number | null,
): MetricDelta {
  return {
    current,
    previous,
    delta:
      current === null && previous === null
        ? null
        : (current || 0) - (previous || 0),
    direction: deltaDirection(current, previous),
  };
}

export function derivePerformanceRates(
  counts: PerformanceCounts,
): DerivedPerformanceRates {
  return {
    ctr: safeRate(counts.clicks, counts.impressions),
    open_rate: safeRate(counts.opens, counts.deliveries),
    click_to_open_rate: safeRate(counts.clicks, counts.opens),
    conversion_rate: safeRate(counts.conversions, counts.clicks),
    delivery_rate: safeRate(
      counts.deliveries,
      counts.impressions || counts.deliveries + counts.failures,
    ),
    failure_rate: safeRate(
      counts.failures,
      counts.deliveries + counts.failures,
    ),
  };
}

function buildSummary(
  counts: PerformanceCounts,
  recordedAt: string | null,
  sources: string[],
): PerformanceSummary {
  return {
    ...counts,
    ...derivePerformanceRates(counts),
    recorded_at: recordedAt,
    sources: uniqueStrings(sources),
  };
}

function mergeCounts(
  left: PerformanceCounts,
  right: PerformanceCounts,
): PerformanceCounts {
  return {
    impressions: left.impressions + right.impressions,
    clicks: left.clicks + right.clicks,
    opens: left.opens + right.opens,
    replies: left.replies + right.replies,
    deliveries: left.deliveries + right.deliveries,
    conversions: left.conversions + right.conversions,
    failures: left.failures + right.failures,
    spend:
      left.spend !== null || right.spend !== null
        ? (left.spend || 0) + (right.spend || 0)
        : null,
    revenue:
      left.revenue !== null || right.revenue !== null
        ? (left.revenue || 0) + (right.revenue || 0)
        : null,
  };
}

function eventCountsFromRow(
  row: CampaignPerformanceEventRow,
): PerformanceCounts {
  const counts = emptyCounts();
  switch (row.event_type) {
    case "delivered":
      counts.deliveries += row.event_count;
      break;
    case "opened":
      counts.opens += row.event_count;
      break;
    case "clicked":
      counts.clicks += row.event_count;
      break;
    case "converted":
      counts.conversions += row.event_count;
      break;
    case "failed":
      counts.failures += row.event_count;
      break;
    case "engaged":
    case "replied":
      counts.replies += row.event_count;
      break;
  }
  return counts;
}

function metricCountsFromInput(
  input: CampaignPerformanceMetricInput,
): PerformanceCounts {
  return {
    impressions: clampNonNegativeInt(input.impressions),
    clicks: clampNonNegativeInt(input.clicks),
    opens: clampNonNegativeInt(input.opens),
    replies: clampNonNegativeInt(input.replies),
    deliveries: clampNonNegativeInt(input.deliveries),
    conversions: clampNonNegativeInt(input.conversions),
    failures: clampNonNegativeInt(input.failures),
    spend: input.spend ?? null,
    revenue: input.revenue ?? null,
  };
}

function mapMetricRow(
  value: Record<string, unknown>,
): CampaignPerformanceMetricRow {
  const counts: PerformanceCounts = {
    impressions: readNumber(value.impressions),
    clicks: readNumber(value.clicks),
    opens: readNumber(value.opens),
    replies: readNumber(value.replies),
    deliveries: readNumber(value.deliveries),
    conversions: readNumber(value.conversions),
    failures: readNumber(value.failures),
    spend: readNullableNumber(value.spend),
    revenue: readNullableNumber(value.revenue),
  };
  const rates = derivePerformanceRates(counts);

  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    campaign_message_id: readNullableString(value.campaign_message_id),
    publish_job_id: readNullableString(value.publish_job_id),
    channel: readString(value.channel) as PerformanceChannel,
    source: readString(value.source),
    ...counts,
    ctr: readNullableNumber(value.ctr) ?? rates.ctr,
    open_rate: readNullableNumber(value.open_rate) ?? rates.open_rate,
    click_to_open_rate:
      readNullableNumber(value.click_to_open_rate) ?? rates.click_to_open_rate,
    conversion_rate:
      readNullableNumber(value.conversion_rate) ?? rates.conversion_rate,
    delivery_rate:
      readNullableNumber(value.delivery_rate) ?? rates.delivery_rate,
    failure_rate: readNullableNumber(value.failure_rate) ?? rates.failure_rate,
    recorded_at: normalizeTimestamp(readNullableString(value.recorded_at)),
    sources: uniqueStrings([readString(value.source)]),
  };
}

function mapEventRow(
  value: Record<string, unknown>,
): CampaignPerformanceEventRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    campaign_message_id: readNullableString(value.campaign_message_id),
    publish_job_id: readNullableString(value.publish_job_id),
    channel: readString(value.channel) as PerformanceChannel,
    event_type: readString(value.event_type) as PerformanceEventType,
    event_count: readNumber(value.event_count),
    target_user_id: readNullableString(value.target_user_id),
    target_identifier: readNullableString(value.target_identifier),
    source: readString(value.source),
    metadata: readRecord(value.metadata),
    occurred_at:
      normalizeTimestamp(readNullableString(value.occurred_at)) ||
      new Date().toISOString(),
  };
}

function buildGroupKey(input: {
  campaign_draft_id: string;
  campaign_message_id: string | null;
  publish_job_id: string | null;
  channel: PerformanceChannel;
}) {
  if (input.publish_job_id) return `job:${input.publish_job_id}`;
  if (input.campaign_message_id) {
    return `message:${input.campaign_message_id}:${input.channel}`;
  }
  return `campaign:${input.campaign_draft_id}:${input.channel}`;
}

function mergeMetricAndEventGroups(args: {
  metrics: CampaignPerformanceMetricRow[];
  events: CampaignPerformanceEventRow[];
}) {
  const latestMetricByKey = new Map<string, CampaignPerformanceMetricRow>();
  args.metrics.forEach((metric) => {
    const key = buildGroupKey(metric);
    const current = latestMetricByKey.get(key);
    if (
      !current ||
      new Date(metric.recorded_at || 0).getTime() >=
        new Date(current.recorded_at || 0).getTime()
    ) {
      latestMetricByKey.set(key, metric);
    }
  });

  const eventCountsAfterMetric = new Map<
    string,
    { counts: PerformanceCounts; latestAt: string | null; sources: string[] }
  >();

  args.events.forEach((event) => {
    const key = buildGroupKey(event);
    const metric = latestMetricByKey.get(key);
    const shouldAccumulate =
      !metric ||
      new Date(event.occurred_at).getTime() >
        new Date(metric.recorded_at || 0).getTime();

    if (!shouldAccumulate) return;

    const current = eventCountsAfterMetric.get(key) || {
      counts: emptyCounts(),
      latestAt: null,
      sources: [],
    };
    current.counts = mergeCounts(current.counts, eventCountsFromRow(event));
    current.latestAt = pickLatestTimestamp(current.latestAt, event.occurred_at);
    current.sources = uniqueStrings([...current.sources, event.source]);
    eventCountsAfterMetric.set(key, current);
  });

  const keys = new Set([
    ...Array.from(latestMetricByKey.keys()),
    ...Array.from(eventCountsAfterMetric.keys()),
  ]);

  const groups: PerformanceGroup[] = [];

  keys.forEach((key) => {
    const metric = latestMetricByKey.get(key);
    const eventAggregate = eventCountsAfterMetric.get(key);
    const baseCounts = metric
      ? {
          impressions: metric.impressions,
          clicks: metric.clicks,
          opens: metric.opens,
          replies: metric.replies,
          deliveries: metric.deliveries,
          conversions: metric.conversions,
          failures: metric.failures,
          spend: metric.spend,
          revenue: metric.revenue,
        }
      : emptyCounts();
    const counts = eventAggregate
      ? mergeCounts(baseCounts, eventAggregate.counts)
      : baseCounts;
    const recordedAt = pickLatestTimestamp(
      metric?.recorded_at,
      eventAggregate?.latestAt || null,
    );
    const sources = uniqueStrings([
      ...(metric ? [metric.source] : []),
      ...(eventAggregate?.sources || []),
    ]);
    const seed =
      metric || args.events.find((item) => buildGroupKey(item) === key);
    if (!seed) return;

    groups.push({
      key,
      campaign_draft_id: seed.campaign_draft_id,
      campaign_message_id: seed.campaign_message_id,
      publish_job_id: seed.publish_job_id,
      channel: seed.channel,
      summary: buildSummary(counts, recordedAt, sources),
    });
  });

  return groups;
}

function selectPreferredGroupsForCampaign(
  campaignId: string,
  groups: PerformanceGroup[],
) {
  const relevant = groups.filter(
    (group) => group.campaign_draft_id === campaignId,
  );
  const jobGroups = relevant.filter((group) => Boolean(group.publish_job_id));
  const messageIdsWithJobs = new Set(
    jobGroups
      .map((group) => group.campaign_message_id)
      .filter((value): value is string => Boolean(value)),
  );
  const messageGroups = relevant.filter(
    (group) =>
      !group.publish_job_id &&
      group.campaign_message_id &&
      !messageIdsWithJobs.has(group.campaign_message_id),
  );
  const hasSpecificData = jobGroups.length > 0 || messageGroups.length > 0;
  const campaignGroups = relevant.filter(
    (group) =>
      !group.publish_job_id && !group.campaign_message_id && !hasSpecificData,
  );

  return [...jobGroups, ...messageGroups, ...campaignGroups];
}

function aggregateSummaries(
  summaries: PerformanceSummary[],
): PerformanceSummary {
  if (!summaries.length) return buildSummary(emptyCounts(), null, []);
  const counts = summaries.reduce(
    (acc, summary) =>
      mergeCounts(acc, {
        impressions: summary.impressions,
        clicks: summary.clicks,
        opens: summary.opens,
        replies: summary.replies,
        deliveries: summary.deliveries,
        conversions: summary.conversions,
        failures: summary.failures,
        spend: summary.spend,
        revenue: summary.revenue,
      }),
    emptyCounts(),
  );
  const recordedAt = summaries.reduce<string | null>(
    (latest, summary) => pickLatestTimestamp(latest, summary.recorded_at),
    null,
  );
  const sources = uniqueStrings(
    summaries.flatMap((summary) => summary.sources),
  );
  return buildSummary(counts, recordedAt, sources);
}

function emptySummary(): PerformanceSummary {
  return buildSummary(emptyCounts(), null, []);
}

function buildComparison(args: {
  current: PerformanceSummary;
  previous: PerformanceSummary;
  range: AnalyticsRange;
}): PerformanceComparison {
  return {
    current: args.current,
    previous: args.previous,
    range: {
      current_from: args.range.currentFrom,
      current_to: args.range.currentTo,
      previous_from: args.range.previousFrom,
      previous_to: args.range.previousTo,
    },
    deltas: {
      deliveries: buildMetricDelta(
        args.current.deliveries,
        args.previous.deliveries,
      ),
      opens: buildMetricDelta(args.current.opens, args.previous.opens),
      clicks: buildMetricDelta(args.current.clicks, args.previous.clicks),
      conversions: buildMetricDelta(
        args.current.conversions,
        args.previous.conversions,
      ),
      failures: buildMetricDelta(args.current.failures, args.previous.failures),
      ctr: buildMetricDelta(args.current.ctr, args.previous.ctr),
      open_rate: buildMetricDelta(
        args.current.open_rate,
        args.previous.open_rate,
      ),
      conversion_rate: buildMetricDelta(
        args.current.conversion_rate,
        args.previous.conversion_rate,
      ),
    },
  };
}

function summaryToTrendPoint(
  bucket: string,
  summary: PerformanceSummary,
): TrendPoint {
  return {
    bucket,
    deliveries: summary.deliveries,
    opens: summary.opens,
    clicks: summary.clicks,
    conversions: summary.conversions,
    failures: summary.failures,
    ctr: summary.ctr,
    open_rate: summary.open_rate,
    conversion_rate: summary.conversion_rate,
  };
}

function buildTrendSeries(args: {
  id: string;
  label: string;
  points: TrendPoint[];
  metric: keyof Pick<
    TrendPoint,
    "deliveries" | "opens" | "clicks" | "conversions" | "failures"
  >;
}): TrendSeries {
  const first = args.points[0]?.[args.metric] ?? 0;
  const last = args.points.at(-1)?.[args.metric] ?? 0;
  const direction = deltaDirection(last, first);
  const summary =
    direction === "up"
      ? `${args.label} is trending up.`
      : direction === "down"
        ? `${args.label} is trending down.`
        : `${args.label} is relatively flat.`;

  return {
    id: args.id,
    label: args.label,
    direction,
    summary,
    points: args.points,
  };
}

function bucketSummariesByDay(summariesByDay: Map<string, PerformanceSummary>) {
  return Array.from(summariesByDay.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, summary]) => summaryToTrendPoint(bucket, summary));
}

function buildDailySummaryMap(args: {
  metrics: CampaignPerformanceMetricRow[];
  events: CampaignPerformanceEventRow[];
  groupFilter?: (group: PerformanceGroup) => boolean;
}) {
  const bucketKeys = new Set([
    ...args.metrics.map((metric) => dayKey(metric.recorded_at)),
    ...args.events.map((event) => dayKey(event.occurred_at)),
  ]);
  const summariesByDay = new Map<string, PerformanceSummary>();

  Array.from(bucketKeys)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .forEach((bucket) => {
      const bucketMetrics = args.metrics.filter(
        (metric) => dayKey(metric.recorded_at) === bucket,
      );
      const bucketEvents = args.events.filter(
        (event) => dayKey(event.occurred_at) === bucket,
      );
      const merged = mergeMetricAndEventGroups({
        metrics: bucketMetrics,
        events: bucketEvents,
      }).filter((group) => (args.groupFilter ? args.groupFilter(group) : true));

      summariesByDay.set(
        bucket,
        aggregateSummaries(merged.map((group) => group.summary)),
      );
    });

  return summariesByDay;
}

async function loadCampaignRows(
  admin: AdminSupabase,
  filters: AnalyticsFilters,
): Promise<AnalyticsCampaignBaseRow[]> {
  if (filters.campaignIds && !filters.campaignIds.length) return [];

  let query = admin
    .from("campaign_drafts")
    .select(
      "id, title, audience, goal, status, publish_status, updated_at, channels, qa_report",
    )
    .order("updated_at", { ascending: false });

  if (filters.campaignId) query = query.eq("id", filters.campaignId);
  if (filters.campaignIds?.length) query = query.in("id", filters.campaignIds);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.audience) query = query.eq("audience", filters.audience);
  if (filters.goal) query = query.eq("goal", filters.goal);
  if (filters.channel) query = query.contains("channels", [filters.channel]);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "failed to load analytics campaigns");
  }

  return (Array.isArray(data) ? data : []).map((row) => {
    const value = readRecord(row);
    const qaReport = readRecord(value.qa_report);
    return {
      id: readString(value.id),
      title: readString(value.title),
      audience: readString(value.audience) as AudienceType,
      goal: readString(value.goal) as CampaignGoal,
      status: readString(value.status) as CampaignWorkflowStatus,
      publish_status: normalizePublishStatus(value.publish_status),
      updated_at: readString(value.updated_at),
      channels: (Array.isArray(value.channels)
        ? value.channels.filter(
            (item): item is PerformanceChannel => typeof item === "string",
          )
        : []) as PerformanceChannel[],
      qa_score: readNumber(qaReport.overall_score),
    };
  });
}

async function loadMessageRows(
  admin: AdminSupabase,
  campaignIds: string[],
): Promise<AnalyticsMessageBaseRow[]> {
  if (!campaignIds.length) return [];

  const { data, error } = await admin
    .from("campaign_messages")
    .select("id, campaign_draft_id, channel, variant_name, status, qa_report")
    .in("campaign_draft_id", campaignIds);

  if (error) {
    throw new Error(error.message || "failed to load analytics messages");
  }

  return (Array.isArray(data) ? data : []).map((row) => {
    const value = readRecord(row);
    const qaReport = readRecord(value.qa_report);
    return {
      id: readString(value.id),
      campaign_draft_id: readString(value.campaign_draft_id),
      channel: readString(value.channel) as PerformanceChannel,
      variant_name: readString(value.variant_name),
      status: readString(value.status) as CampaignWorkflowStatus,
      qa_score: readNumber(qaReport.overall_score),
    };
  });
}

async function loadPublishJobs(
  admin: AdminSupabase,
  campaignIds: string[],
  channel?: PerformanceChannel | "",
): Promise<CampaignPublishJobRow[]> {
  if (!campaignIds.length) return [];

  let query = admin
    .from("campaign_publish_jobs")
    .select("*")
    .in("campaign_draft_id", campaignIds)
    .order("triggered_at", { ascending: false });

  if (channel) query = query.eq("channel", channel);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "failed to load analytics publish jobs");
  }

  return (Array.isArray(data) ? data : []).map((row) => {
    const value = readRecord(row);
    return {
      id: readString(value.id),
      campaign_draft_id: readString(value.campaign_draft_id),
      channel: readString(value.channel) as PublishChannel,
      message_id: readNullableString(value.message_id),
      publish_status: normalizePublishStatus(value.publish_status),
      publish_mode: readString(
        value.publish_mode,
      ) as CampaignPublishJobRow["publish_mode"],
      provider_name: readString(value.provider_name),
      provider_response_summary: readString(value.provider_response_summary),
      payload: readRecord(value.payload),
      external_reference_id: readNullableString(value.external_reference_id),
      error_message: readNullableString(value.error_message),
      triggered_by: readNullableString(value.triggered_by),
      triggered_at: readString(value.triggered_at),
      completed_at: readNullableString(value.completed_at),
    };
  });
}

async function loadMetricRows(
  admin: AdminSupabase,
  campaignIds: string[],
  filters: AnalyticsFilters,
): Promise<CampaignPerformanceMetricRow[]> {
  if (!campaignIds.length) return [];

  let query = admin
    .from("campaign_performance_metrics")
    .select("*")
    .in("campaign_draft_id", campaignIds)
    .order("recorded_at", { ascending: false });

  if (filters.channel) query = query.eq("channel", filters.channel);
  if (filters.from)
    query = query.gte("recorded_at", new Date(filters.from).toISOString());
  if (filters.to)
    query = query.lte("recorded_at", new Date(filters.to).toISOString());

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "failed to load performance metrics");
  }

  return (Array.isArray(data) ? data : []).map((row) =>
    mapMetricRow(row as Record<string, unknown>),
  );
}

async function loadEventRows(
  admin: AdminSupabase,
  campaignIds: string[],
  filters: AnalyticsFilters,
): Promise<CampaignPerformanceEventRow[]> {
  if (!campaignIds.length) return [];

  let query = admin
    .from("campaign_performance_events")
    .select("*")
    .in("campaign_draft_id", campaignIds)
    .order("occurred_at", { ascending: false });

  if (filters.channel) query = query.eq("channel", filters.channel);
  if (filters.from)
    query = query.gte("occurred_at", new Date(filters.from).toISOString());
  if (filters.to)
    query = query.lte("occurred_at", new Date(filters.to).toISOString());

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "failed to load performance events");
  }

  return (Array.isArray(data) ? data : []).map((row) =>
    mapEventRow(row as Record<string, unknown>),
  );
}

async function loadProviderEventRows(
  admin: AdminSupabase,
  campaignIds: string[],
): Promise<CampaignProviderEventRow[]> {
  if (!campaignIds.length) return [];

  const { data, error } = await admin
    .from("campaign_provider_events")
    .select("*")
    .in("campaign_draft_id", campaignIds)
    .order("event_timestamp", { ascending: false });

  if (error) {
    throw new Error(error.message || "failed to load provider events");
  }

  return (Array.isArray(data) ? data : []).map((row) => {
    const value = readRecord(row);
    return {
      id: readString(value.id),
      provider_name: readString(value.provider_name),
      provider_event_id: readNullableString(value.provider_event_id),
      dedupe_key: readString(value.dedupe_key),
      event_source: readString(
        value.event_source,
      ) as CampaignProviderEventRow["event_source"],
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
      processed_status: readString(
        value.processed_status,
      ) as CampaignProviderEventRow["processed_status"],
      error_message: readNullableString(value.error_message),
      payload: readRecord(value.payload),
      normalized_metadata: readRecord(value.normalized_metadata),
      created_at: readString(value.created_at),
    };
  });
}

export async function ingestCampaignAnalytics(
  admin: AdminSupabase,
  payload: {
    metrics?: CampaignPerformanceMetricInput[];
    events?: CampaignPerformanceEventInput[];
  },
) {
  const parsed = analyticsIngestSchema.parse(payload);
  const metricRows = parsed.metrics.map((metric) => {
    const counts = metricCountsFromInput(metric);
    const rates = derivePerformanceRates(counts);
    return {
      campaign_draft_id: metric.campaignDraftId,
      campaign_message_id: metric.campaignMessageId ?? null,
      publish_job_id: metric.publishJobId ?? null,
      channel: metric.channel,
      source: metric.source,
      impressions: counts.impressions,
      clicks: counts.clicks,
      opens: counts.opens,
      replies: counts.replies,
      deliveries: counts.deliveries,
      conversions: counts.conversions,
      failures: counts.failures,
      spend: counts.spend,
      revenue: counts.revenue,
      ctr: rates.ctr,
      open_rate: rates.open_rate,
      click_to_open_rate: rates.click_to_open_rate,
      conversion_rate: rates.conversion_rate,
      delivery_rate: rates.delivery_rate,
      failure_rate: rates.failure_rate,
      recorded_at: metric.recordedAt
        ? new Date(metric.recordedAt).toISOString()
        : new Date().toISOString(),
    };
  });

  const eventRows = parsed.events.map((event) => ({
    campaign_draft_id: event.campaignDraftId,
    campaign_message_id: event.campaignMessageId ?? null,
    publish_job_id: event.publishJobId ?? null,
    channel: event.channel,
    event_type: event.eventType,
    event_count: event.count,
    target_user_id: event.targetUserId ?? null,
    target_identifier: event.targetIdentifier ?? null,
    source: event.source,
    metadata: event.metadata,
    occurred_at: event.occurredAt
      ? new Date(event.occurredAt).toISOString()
      : new Date().toISOString(),
  }));

  if (metricRows.length) {
    const { error } = await admin
      .from("campaign_performance_metrics")
      .insert(metricRows as never);
    if (error) {
      throw new Error(error.message || "failed to ingest performance metrics");
    }
  }

  if (eventRows.length) {
    const { error } = await admin
      .from("campaign_performance_events")
      .insert(eventRows as never);
    if (error) {
      throw new Error(error.message || "failed to ingest performance events");
    }
  }

  return {
    metricsIngested: metricRows.length,
    eventsIngested: eventRows.length,
    affectedCampaignIds: Array.from(
      new Set([
        ...parsed.metrics.map((metric) => metric.campaignDraftId),
        ...parsed.events.map((event) => event.campaignDraftId),
      ]),
    ),
    metricSources: uniqueStrings(parsed.metrics.map((metric) => metric.source)),
    eventSources: uniqueStrings(parsed.events.map((event) => event.source)),
  };
}

export async function recordPublishJobPerformanceSnapshot(input: {
  admin: AdminSupabase;
  campaignId: string;
  messageId?: string | null;
  publishJobId?: string | null;
  channel: PerformanceChannel;
  publishMode: CampaignPublishJobRow["publish_mode"];
  publishStatus: CampaignPublishStatus;
  source?: string;
  targetCount?: number;
  recordedAt?: string | null;
}) {
  if (input.publishMode !== "live") return;
  const targetCount = clampNonNegativeInt(input.targetCount || 0);
  if (!targetCount) return;

  const success = input.publishStatus === "published";
  await ingestCampaignAnalytics(input.admin, {
    metrics: [
      {
        campaignDraftId: input.campaignId,
        campaignMessageId: input.messageId || undefined,
        publishJobId: input.publishJobId || undefined,
        channel: input.channel,
        impressions: 0,
        clicks: 0,
        opens: 0,
        replies: 0,
        deliveries: success ? targetCount : 0,
        conversions: 0,
        failures: success ? 0 : targetCount,
        spend: null,
        revenue: null,
        recordedAt: input.recordedAt || undefined,
        source: input.source || "publish_connector",
      },
    ],
    events: [
      {
        campaignDraftId: input.campaignId,
        campaignMessageId: input.messageId || undefined,
        publishJobId: input.publishJobId || undefined,
        channel: input.channel,
        eventType: success ? "delivered" : "failed",
        count: targetCount,
        metadata: {},
        occurredAt: input.recordedAt || undefined,
        source: input.source || "publish_connector",
      },
    ],
  });
}

export async function getCampaignAnalyticsDetail(
  admin: AdminSupabase,
  campaignId: string,
  filters: Pick<AnalyticsFilters, "from" | "to"> = {},
): Promise<CampaignAnalyticsDetail> {
  const range = resolveAnalyticsRange(filters);
  const campaigns = await loadCampaignRows(admin, { campaignId });
  if (!campaigns.length) {
    const emptySignalSummary = buildSignalSummary({
      summary: emptySummary(),
      providerEvents: [],
    });
    return {
      summary: emptySummary(),
      signal_summary: emptySignalSummary,
      comparison: buildComparison({
        current: emptySummary(),
        previous: emptySummary(),
        range,
      }),
      channel_breakdown: [],
      message_breakdown: [],
      publish_job_breakdown: [],
      campaign_trend: buildTrendSeries({
        id: "campaign",
        label: "Campaign",
        points: [],
        metric: "clicks",
      }),
      channel_trends: [],
      message_trends: [],
      publish_job_trend: buildTrendSeries({
        id: "publish-jobs",
        label: "Publish jobs",
        points: [],
        metric: "deliveries",
      }),
      recent_events: [],
    };
  }

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const [
    messages,
    publishJobs,
    metrics,
    events,
    providerEvents,
    previousMetrics,
    previousEvents,
  ] = await Promise.all([
    loadMessageRows(admin, campaignIds),
    loadPublishJobs(admin, campaignIds),
    loadMetricRows(admin, campaignIds, {
      from: range.currentFrom,
      to: range.currentTo,
    }),
    loadEventRows(admin, campaignIds, {
      from: range.currentFrom,
      to: range.currentTo,
    }),
    loadProviderEventRows(admin, campaignIds),
    loadMetricRows(admin, campaignIds, {
      from: range.previousFrom,
      to: range.previousTo,
    }),
    loadEventRows(admin, campaignIds, {
      from: range.previousFrom,
      to: range.previousTo,
    }),
  ]);

  const mergedGroups = mergeMetricAndEventGroups({ metrics, events });
  const previousMergedGroups = mergeMetricAndEventGroups({
    metrics: previousMetrics,
    events: previousEvents,
  });
  const selectedGroups = selectPreferredGroupsForCampaign(
    campaignId,
    mergedGroups,
  );
  const previousSelectedGroups = selectPreferredGroupsForCampaign(
    campaignId,
    previousMergedGroups,
  );
  const summary = aggregateSummaries(
    selectedGroups.map((group) => group.summary),
  );
  const previousSummary = aggregateSummaries(
    previousSelectedGroups.map((group) => group.summary),
  );
  const signal_summary = buildSignalSummary({
    summary,
    providerEvents: providerEvents.filter(
      (event) => event.campaign_draft_id === campaignId,
    ),
  });

  const channel_breakdown = uniqueStrings(
    selectedGroups.map((group) => group.channel),
  )
    .map((channel) => ({
      channel: channel as PerformanceChannel,
      ...aggregateSummaries(
        selectedGroups
          .filter((group) => group.channel === channel)
          .map((group) => group.summary),
      ),
      ...buildSignalSummary({
        summary: aggregateSummaries(
          selectedGroups
            .filter((group) => group.channel === channel)
            .map((group) => group.summary),
        ),
        providerEvents: providerEvents.filter(
          (event) =>
            event.campaign_draft_id === campaignId && event.channel === channel,
        ),
      }),
    }))
    .sort(
      (left, right) =>
        right.conversions - left.conversions ||
        right.clicks - left.clicks ||
        right.deliveries - left.deliveries,
    );

  const message_breakdown = messages
    .map((message) => {
      const relevant = mergedGroups.filter(
        (group) => group.campaign_message_id === message.id,
      );
      const chosen = relevant.some((group) => group.publish_job_id)
        ? relevant.filter((group) => group.publish_job_id)
        : relevant;
      return {
        campaign_draft_id: message.campaign_draft_id,
        message_id: message.id,
        channel: message.channel,
        variant_name: message.variant_name,
        status: message.status,
        qa_score: message.qa_score,
        ...aggregateSummaries(chosen.map((group) => group.summary)),
        ...buildSignalSummary({
          summary: aggregateSummaries(chosen.map((group) => group.summary)),
          providerEvents: providerEvents.filter(
            (event) => event.campaign_message_id === message.id,
          ),
        }),
      };
    })
    .sort(
      (left, right) =>
        right.conversions - left.conversions ||
        right.clicks - left.clicks ||
        (right.ctr || 0) - (left.ctr || 0),
    );

  const messageNameById = new Map(
    messages.map((message) => [message.id, message.variant_name]),
  );

  const publish_job_breakdown = publishJobs.map((job) => ({
    job_id: job.id,
    campaign_draft_id: job.campaign_draft_id,
    campaign_title: campaigns[0].title,
    channel: job.channel,
    publish_status: job.publish_status,
    publish_mode: job.publish_mode,
    provider_name: job.provider_name,
    triggered_at: job.triggered_at,
    completed_at: job.completed_at,
    message_id: job.message_id,
    message_variant_name: job.message_id
      ? messageNameById.get(job.message_id) || null
      : null,
    ...(mergedGroups.find((group) => group.publish_job_id === job.id)
      ?.summary || emptySummary()),
    ...buildSignalSummary({
      summary:
        mergedGroups.find((group) => group.publish_job_id === job.id)
          ?.summary || emptySummary(),
      providerEvents: providerEvents.filter(
        (event) => event.publish_job_id === job.id,
      ),
    }),
  }));

  const campaign_trend = buildTrendSeries({
    id: campaignId,
    label: campaigns[0].title,
    points: bucketSummariesByDay(
      buildDailySummaryMap({
        metrics,
        events,
        groupFilter: (group) => group.campaign_draft_id === campaignId,
      }),
    ),
    metric: "clicks",
  });
  const channel_trends = channel_breakdown.map((channelRow) =>
    buildTrendSeries({
      id: channelRow.channel,
      label: labelChannel(channelRow.channel),
      points: bucketSummariesByDay(
        buildDailySummaryMap({
          metrics,
          events,
          groupFilter: (group) =>
            group.campaign_draft_id === campaignId &&
            group.channel === channelRow.channel,
        }),
      ),
      metric: channelRow.channel === "email" ? "opens" : "clicks",
    }),
  );
  const message_trends = message_breakdown
    .filter(
      (message) =>
        message.deliveries > 0 ||
        message.clicks > 0 ||
        message.opens > 0 ||
        message.conversions > 0,
    )
    .map((message) =>
      buildTrendSeries({
        id: message.message_id,
        label: message.variant_name,
        points: bucketSummariesByDay(
          buildDailySummaryMap({
            metrics,
            events,
            groupFilter: (group) =>
              group.campaign_message_id === message.message_id,
          }),
        ),
        metric: message.channel === "email" ? "opens" : "clicks",
      }),
    );
  const publish_job_trend = buildTrendSeries({
    id: `${campaignId}-publish-jobs`,
    label: "Recent publish jobs",
    points: bucketSummariesByDay(
      buildDailySummaryMap({
        metrics,
        events,
        groupFilter: (group) =>
          group.campaign_draft_id === campaignId &&
          Boolean(group.publish_job_id),
      }),
    ),
    metric: "deliveries",
  });

  return {
    summary,
    signal_summary,
    comparison: buildComparison({
      current: summary,
      previous: previousSummary,
      range,
    }),
    channel_breakdown,
    message_breakdown,
    publish_job_breakdown,
    campaign_trend,
    channel_trends,
    message_trends,
    publish_job_trend,
    recent_events: events.slice(0, 20),
  };
}

export async function getCampaignAnalyticsDashboard(
  admin: AdminSupabase,
  filters: AnalyticsFilters,
): Promise<CampaignAnalyticsDashboard> {
  const range = resolveAnalyticsRange(filters);
  const campaigns = await loadCampaignRows(admin, filters);
  const campaignIds = campaigns.map((campaign) => campaign.id);

  if (!campaignIds.length) {
    const emptySignalSummary = buildSignalSummary({
      summary: emptySummary(),
      providerEvents: [],
    });
    return {
      totals: {
        ...emptySummary(),
        campaign_count: 0,
        published_campaign_count: 0,
        publish_job_count: 0,
      },
      signal_overview: emptySignalSummary,
      comparison: buildComparison({
        current: emptySummary(),
        previous: emptySummary(),
        range,
      }),
      channel_breakdown: [],
      campaign_rows: [],
      top_messages: [],
      recent_publish_jobs: [],
      campaign_trends: [],
      channel_trends: [],
      publish_job_trend: buildTrendSeries({
        id: "publish-jobs",
        label: "Recent publish jobs",
        points: [],
        metric: "deliveries",
      }),
      recent_events: [],
    };
  }

  const [
    messages,
    publishJobs,
    metrics,
    events,
    providerEvents,
    previousMetrics,
    previousEvents,
  ] = await Promise.all([
    loadMessageRows(admin, campaignIds),
    loadPublishJobs(admin, campaignIds, filters.channel),
    loadMetricRows(admin, campaignIds, filters),
    loadEventRows(admin, campaignIds, filters),
    loadProviderEventRows(admin, campaignIds),
    loadMetricRows(admin, campaignIds, {
      ...filters,
      from: range.previousFrom,
      to: range.previousTo,
    }),
    loadEventRows(admin, campaignIds, {
      ...filters,
      from: range.previousFrom,
      to: range.previousTo,
    }),
  ]);

  const mergedGroups = mergeMetricAndEventGroups({ metrics, events });
  const previousMergedGroups = mergeMetricAndEventGroups({
    metrics: previousMetrics,
    events: previousEvents,
  });
  const selectedGroups = campaigns.flatMap((campaign) =>
    selectPreferredGroupsForCampaign(campaign.id, mergedGroups),
  );
  const previousSelectedGroups = campaigns.flatMap((campaign) =>
    selectPreferredGroupsForCampaign(campaign.id, previousMergedGroups),
  );

  const campaign_rows = campaigns.map((campaign) => ({
    id: campaign.id,
    title: campaign.title,
    audience: campaign.audience,
    goal: campaign.goal,
    status: campaign.status,
    publish_status: campaign.publish_status,
    updated_at: campaign.updated_at,
    qa_score: campaign.qa_score,
    channel_count: campaign.channels.length,
    publish_job_count: publishJobs.filter(
      (job) => job.campaign_draft_id === campaign.id,
    ).length,
    summary: aggregateSummaries(
      selectPreferredGroupsForCampaign(campaign.id, mergedGroups).map(
        (group) => group.summary,
      ),
    ),
    signal_summary: buildSignalSummary({
      summary: aggregateSummaries(
        selectPreferredGroupsForCampaign(campaign.id, mergedGroups).map(
          (group) => group.summary,
        ),
      ),
      providerEvents: providerEvents.filter(
        (event) => event.campaign_draft_id === campaign.id,
      ),
    }),
  }));

  const totals = {
    ...aggregateSummaries(campaign_rows.map((row) => row.summary)),
    campaign_count: campaign_rows.length,
    published_campaign_count: campaign_rows.filter(
      (row) => row.publish_status === "published",
    ).length,
    publish_job_count: publishJobs.length,
  };
  const signal_overview = buildSignalSummary({
    summary: aggregateSummaries(campaign_rows.map((row) => row.summary)),
    providerEvents,
  });
  const channel_breakdown = uniqueStrings(
    selectedGroups.map((group) => group.channel),
  )
    .map((channel) => ({
      channel: channel as PerformanceChannel,
      ...aggregateSummaries(
        selectedGroups
          .filter((group) => group.channel === channel)
          .map((group) => group.summary),
      ),
      ...buildSignalSummary({
        summary: aggregateSummaries(
          selectedGroups
            .filter((group) => group.channel === channel)
            .map((group) => group.summary),
        ),
        providerEvents: providerEvents.filter(
          (event) => event.channel === channel,
        ),
      }),
    }))
    .sort(
      (left, right) =>
        right.conversions - left.conversions ||
        right.clicks - left.clicks ||
        right.deliveries - left.deliveries,
    );

  const top_messages = messages
    .map((message) => {
      const relevant = mergedGroups.filter(
        (group) => group.campaign_message_id === message.id,
      );
      const chosen = relevant.some((group) => group.publish_job_id)
        ? relevant.filter((group) => group.publish_job_id)
        : relevant;
      return {
        campaign_draft_id: message.campaign_draft_id,
        message_id: message.id,
        channel: message.channel,
        variant_name: message.variant_name,
        status: message.status,
        qa_score: message.qa_score,
        ...aggregateSummaries(chosen.map((group) => group.summary)),
        ...buildSignalSummary({
          summary: aggregateSummaries(chosen.map((group) => group.summary)),
          providerEvents: providerEvents.filter(
            (event) => event.campaign_message_id === message.id,
          ),
        }),
      };
    })
    .filter(
      (message) =>
        message.deliveries > 0 ||
        message.impressions > 0 ||
        message.clicks > 0 ||
        message.conversions > 0,
    )
    .sort(
      (left, right) =>
        right.conversions - left.conversions ||
        right.clicks - left.clicks ||
        (right.ctr || 0) - (left.ctr || 0),
    )
    .slice(0, 10);

  const campaignTitleById = new Map(
    campaigns.map((campaign) => [campaign.id, campaign.title]),
  );
  const messageNameById = new Map(
    messages.map((message) => [message.id, message.variant_name]),
  );

  const recent_publish_jobs = publishJobs
    .map((job) => ({
      job_id: job.id,
      campaign_draft_id: job.campaign_draft_id,
      campaign_title:
        campaignTitleById.get(job.campaign_draft_id) || "Campaign",
      channel: job.channel,
      publish_status: job.publish_status,
      publish_mode: job.publish_mode,
      provider_name: job.provider_name,
      triggered_at: job.triggered_at,
      completed_at: job.completed_at,
      message_id: job.message_id,
      message_variant_name: job.message_id
        ? messageNameById.get(job.message_id) || null
        : null,
      ...(mergedGroups.find((group) => group.publish_job_id === job.id)
        ?.summary || emptySummary()),
      ...buildSignalSummary({
        summary:
          mergedGroups.find((group) => group.publish_job_id === job.id)
            ?.summary || emptySummary(),
        providerEvents: providerEvents.filter(
          (event) => event.publish_job_id === job.id,
        ),
      }),
    }))
    .sort(
      (left, right) =>
        new Date(right.triggered_at).getTime() -
        new Date(left.triggered_at).getTime(),
    );
  const channel_trends = channel_breakdown.map((channelRow) =>
    buildTrendSeries({
      id: channelRow.channel,
      label: labelChannel(channelRow.channel),
      points: bucketSummariesByDay(
        buildDailySummaryMap({
          metrics,
          events,
          groupFilter: (group) => group.channel === channelRow.channel,
        }),
      ),
      metric: channelRow.channel === "email" ? "opens" : "clicks",
    }),
  );
  const campaign_trends = campaign_rows
    .slice()
    .sort(
      (left, right) =>
        right.summary.conversions - left.summary.conversions ||
        right.summary.clicks - left.summary.clicks ||
        right.summary.deliveries - left.summary.deliveries,
    )
    .slice(0, 8)
    .map((campaign) =>
      buildTrendSeries({
        id: campaign.id,
        label: campaign.title,
        points: bucketSummariesByDay(
          buildDailySummaryMap({
            metrics,
            events,
            groupFilter: (group) => group.campaign_draft_id === campaign.id,
          }),
        ),
        metric: "clicks",
      }),
    );
  const publish_job_trend = buildTrendSeries({
    id: "recent-publish-jobs",
    label: "Recent publish jobs",
    points: bucketSummariesByDay(
      buildDailySummaryMap({
        metrics,
        events,
        groupFilter: (group) => Boolean(group.publish_job_id),
      }),
    ),
    metric: "deliveries",
  });

  return {
    totals,
    signal_overview,
    comparison: buildComparison({
      current: aggregateSummaries(selectedGroups.map((group) => group.summary)),
      previous: aggregateSummaries(
        previousSelectedGroups.map((group) => group.summary),
      ),
      range,
    }),
    channel_breakdown,
    campaign_rows,
    top_messages,
    recent_publish_jobs,
    campaign_trends,
    channel_trends,
    publish_job_trend,
    recent_events: events.slice(0, 20),
  };
}

export function summarizePublishTargets(targeting: {
  targetEmails?: string[];
  targetUserIds?: string[];
  targetPhone?: string | null;
}) {
  return (
    (Array.isArray(targeting.targetEmails)
      ? targeting.targetEmails.length
      : 0) +
    (Array.isArray(targeting.targetUserIds)
      ? targeting.targetUserIds.length
      : 0) +
    (targeting.targetPhone ? 1 : 0)
  );
}
