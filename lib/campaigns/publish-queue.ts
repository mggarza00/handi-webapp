import type { SupabaseClient } from "@supabase/supabase-js";

import { getCampaignDetail } from "@/lib/campaigns/repository";
import {
  createPublishJob,
  loadPublishJob,
  lockPublishJob,
  parsePublishTargeting,
  runPublishJob,
  updatePublishJob,
} from "@/lib/campaigns/publish";
import { logAudit } from "@/lib/log-audit";
import { getPublishableChannels } from "@/lib/publish/index";
import type { PublishTargeting } from "@/lib/publish/types";
import type { Database } from "@/types/supabase";
import type {
  CampaignPublishJobRow,
  CampaignPublishMode,
  CampaignPublishQueueDeferredReason,
  CampaignPublishQueueErrorType,
  CampaignPublishQueueHealthStatus,
  CampaignPublishQueueStatus,
  CampaignPublishStatus,
  PublishChannel,
} from "@/lib/campaigns/workflow";

type AdminSupabase = SupabaseClient<Database>;

type QueueChannelLimits = {
  maxPerRun: number;
  maxRunning: number;
  maxRunningPerCampaign: number;
};

type RunQueueSource = "admin" | "cron";

type QueueRunJobOutcome =
  | "completed"
  | "failed"
  | "skipped"
  | "retry_scheduled"
  | "deferred";

type QueueRunJobSummary = {
  jobId: string;
  campaignId: string;
  channel: PublishChannel;
  status: QueueRunJobOutcome;
  queueStatus: CampaignPublishQueueStatus;
  errorType: CampaignPublishQueueErrorType | null;
  deferredReason: CampaignPublishQueueDeferredReason | null;
  note: string;
};

export type PublishQueueRunResult = {
  scanned: number;
  started: number;
  completed: number;
  failed: number;
  skipped: number;
  retriesScheduled: number;
  deferred: number;
  throttled: number;
  concurrencyBlocked: number;
  jobs: QueueRunJobSummary[];
  processed: number;
  rescheduled: number;
};

type PublishQueueHealthChannelSummary = {
  channel: PublishChannel;
  healthStatus: CampaignPublishQueueHealthStatus;
  readyJobs: number;
  runningJobs: number;
  failedRecently: number;
  retryPendingJobs: number;
  throttledJobs: number;
  concurrencyBlockedJobs: number;
  lastError: string | null;
  lastErrorAt: string | null;
};

export type PublishQueueHealthSummary = {
  healthStatus: CampaignPublishQueueHealthStatus;
  readyJobs: number;
  runningJobs: number;
  failedRecently: number;
  retryPendingJobs: number;
  throttledJobs: number;
  concurrencyBlockedJobs: number;
  lastRunDueAt: string | null;
  lastRunDueSource: RunQueueSource | null;
  lastRunDueSummary: string | null;
  channels: PublishQueueHealthChannelSummary[];
};

type ScheduleCampaignPublishInput = {
  admin: AdminSupabase;
  campaignId: string;
  channel: PublishChannel;
  publishMode: CampaignPublishMode;
  targeting: PublishTargeting;
  scheduledFor?: string | null;
  executionWindowStart?: string | null;
  executionWindowEnd?: string | null;
  triggeredBy: string | null;
  maxRetries?: number;
};

type ReschedulePublishJobInput = {
  admin: AdminSupabase;
  jobId: string;
  scheduledFor?: string | null;
  executionWindowStart?: string | null;
  executionWindowEnd?: string | null;
  maxRetries?: number;
};

type RunPublishJobNowInput = {
  admin: AdminSupabase;
  jobId: string;
  triggeredBy: string | null;
};

type RunDuePublishJobsInput = {
  admin: AdminSupabase;
  triggeredBy: string | null;
  limit?: number;
  lockOwner?: string | null;
  source?: RunQueueSource;
};

type QueueExecutionContext = {
  admin: AdminSupabase;
  now: Date;
  triggeredBy: string | null;
  lockOwner: string;
};

const RUNNABLE_QUEUE_STATUSES: CampaignPublishQueueStatus[] = [
  "queued",
  "scheduled",
  "ready",
  "failed",
];
const ACTIVE_QUEUE_STATUSES: CampaignPublishQueueStatus[] = [
  "queued",
  "scheduled",
  "ready",
  "running",
  "failed",
  "paused",
];
const RETRY_DELAYS_MINUTES = [15, 60, 180];
const RATE_LIMIT_RETRY_DELAYS_MINUTES = [30, 120, 360];
const FAILED_RECENT_LOOKBACK_HOURS = 24;
const RECOVERABLE_ERROR_TYPES = new Set<CampaignPublishQueueErrorType>([
  "recoverable_transient",
  "recoverable_rate_limited",
]);

export const PUBLISH_QUEUE_CHANNEL_LIMITS: Record<
  PublishChannel,
  QueueChannelLimits
> = {
  email: { maxPerRun: 5, maxRunning: 2, maxRunningPerCampaign: 1 },
  push: { maxPerRun: 4, maxRunning: 2, maxRunningPerCampaign: 1 },
  whatsapp: { maxPerRun: 8, maxRunning: 1, maxRunningPerCampaign: 1 },
  meta: { maxPerRun: 10, maxRunning: 1, maxRunningPerCampaign: 1 },
  landing: { maxPerRun: 8, maxRunning: 1, maxRunningPerCampaign: 1 },
  google: { maxPerRun: 10, maxRunning: 1, maxRunningPerCampaign: 1 },
};

function validateScheduleWindow(args: {
  scheduledFor: string | null;
  executionWindowStart: string | null;
  executionWindowEnd: string | null;
}) {
  const scheduledAt = parseOptionalDate(args.scheduledFor);
  const windowStart = parseOptionalDate(args.executionWindowStart);
  const windowEnd = parseOptionalDate(args.executionWindowEnd);

  if (windowStart && windowEnd && windowStart > windowEnd) {
    throw new Error(
      "Execution window start must be before execution window end.",
    );
  }
  if (scheduledAt && windowStart && scheduledAt < windowStart) {
    throw new Error("Scheduled time must be inside the execution window.");
  }
  if (scheduledAt && windowEnd && scheduledAt > windowEnd) {
    throw new Error("Scheduled time must be inside the execution window.");
  }

  return {
    scheduledFor: scheduledAt?.toISOString() || null,
    executionWindowStart: windowStart?.toISOString() || null,
    executionWindowEnd: windowEnd?.toISOString() || null,
  };
}

function resolveQueueStatus(args: {
  scheduledFor: string | null;
  executionWindowStart: string | null;
}) {
  const now = Date.now();
  const dueAt = [args.scheduledFor, args.executionWindowStart]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)[0];

  if (typeof dueAt === "number" && dueAt > now) {
    return "scheduled" as const;
  }

  return "ready" as const;
}

function isCampaignSchedulable(status: CampaignPublishStatus) {
  return ["ready_to_publish", "published", "publish_failed"].includes(status);
}

async function assertCampaignChannelSchedulingAllowed(input: {
  admin: AdminSupabase;
  campaignId: string;
  channel: PublishChannel;
  publishMode: CampaignPublishMode;
}) {
  const detail = await getCampaignDetail(input.admin, input.campaignId);
  if (!detail) {
    throw new Error("Campaign not found.");
  }
  if (detail.draft.status !== "approved") {
    throw new Error("Only approved campaigns can be scheduled.");
  }
  if (!isCampaignSchedulable(detail.draft.publish_status)) {
    throw new Error(
      "Campaign must be ready to publish before entering the queue.",
    );
  }

  const connector = getPublishableChannels(detail.draft.channels).find(
    (candidate) => candidate.channel === input.channel,
  );
  if (!connector) {
    throw new Error(
      `Channel ${input.channel} is not available for this campaign.`,
    );
  }
  if (!connector.supportedModes.includes(input.publishMode)) {
    throw new Error(
      `${connector.label} only supports ${connector.supportedModes.join(", ")} mode(s).`,
    );
  }

  return detail;
}

async function fetchRunnableJobs(admin: AdminSupabase) {
  const { data, error } = await admin
    .from("campaign_publish_jobs")
    .select("*")
    .in("queue_status", RUNNABLE_QUEUE_STATUSES)
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .order("next_retry_at", { ascending: true, nullsFirst: true })
    .order("triggered_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to list runnable publish jobs.");
  }

  return (Array.isArray(data) ? data : []).map((row) =>
    mapPublishJob(row as Record<string, unknown>),
  );
}

function resolveJobDueAt(job: CampaignPublishJobRow) {
  if (job.next_retry_at) return new Date(job.next_retry_at).getTime();
  if (job.scheduled_for) return new Date(job.scheduled_for).getTime();
  if (job.execution_window_start) {
    return new Date(job.execution_window_start).getTime();
  }
  return Number.NEGATIVE_INFINITY;
}

function isJobDue(job: CampaignPublishJobRow, now: Date) {
  const dueAt = resolveJobDueAt(job);
  return !Number.isFinite(dueAt) || dueAt <= now.getTime();
}

function classifyPublishError(
  message: string | null,
): CampaignPublishQueueErrorType {
  const text = (message || "").toLowerCase();
  if (!text) return "unknown_error";
  if (/rate limit|too many requests|429/.test(text)) {
    return "recoverable_rate_limited";
  }
  if (
    /vapid|api key|credential|credentials|secret|missing .*key|not configured|configuration|required for live/.test(
      text,
    )
  ) {
    return "configuration_error";
  }
  if (/only approved campaigns|not approved/.test(text)) {
    return "approval_error";
  }
  if (
    /ready to publish|not publishable|ready before entering the queue/.test(
      text,
    )
  ) {
    return "readiness_error";
  }
  if (/unsupported publish channel|only supports/.test(text)) {
    return "unsupported_channel";
  }
  if (/recipient|target user|target users|targeting|target phone/.test(text)) {
    return "targeting_error";
  }
  if (/window expired|execution window/.test(text)) {
    return "expired_window";
  }
  if (/lock|already running/.test(text)) {
    return "lock_conflict";
  }
  if (
    /timeout|timed out|network|temporar|service unavailable|internal server error|fetch failed|send failed/.test(
      text,
    )
  ) {
    return "recoverable_transient";
  }
  return "unknown_error";
}

function isRetryableErrorType(errorType: CampaignPublishQueueErrorType) {
  return RECOVERABLE_ERROR_TYPES.has(errorType);
}

function getRetryDelayMinutes(
  errorType: CampaignPublishQueueErrorType,
  retryCount: number,
) {
  const delays =
    errorType === "recoverable_rate_limited"
      ? RATE_LIMIT_RETRY_DELAYS_MINUTES
      : RETRY_DELAYS_MINUTES;
  return delays[Math.min(retryCount - 1, delays.length - 1)];
}

function summarizeQueueHealth(args: {
  ready: number;
  running: number;
  failedRecently: number;
  retries: number;
  throttled: number;
  concurrencyBlocked: number;
}): CampaignPublishQueueHealthStatus {
  if (args.failedRecently > 0) return "degraded";
  if (
    args.ready > 0 ||
    args.running > 0 ||
    args.retries > 0 ||
    args.throttled > 0 ||
    args.concurrencyBlocked > 0
  ) {
    return "attention";
  }
  return "healthy";
}

async function logQueueAudit(
  actorId: string | null,
  action: string,
  job: CampaignPublishJobRow,
  note: string,
  extraMeta?: Record<string, unknown>,
) {
  await logAudit({
    actorId,
    action,
    entity: "campaign_drafts",
    entityId: job.campaign_draft_id,
    meta: {
      note,
      publishJobId: job.id,
      channel: job.channel,
      publishMode: job.publish_mode,
      messageId: job.message_id,
      queueStatus: job.queue_status,
      errorType: job.error_type,
      deferredReason: job.deferred_reason,
      ...extraMeta,
    },
  });
}

async function markDeferred(args: {
  admin: AdminSupabase;
  job: CampaignPublishJobRow;
  actorId: string | null;
  deferredReason: CampaignPublishQueueDeferredReason;
  note: string;
  action:
    | "CAMPAIGN_PUBLISH_CHANNEL_THROTTLED"
    | "CAMPAIGN_PUBLISH_CONCURRENCY_BLOCKED";
}) {
  const updated = await updatePublishJob(args.admin, args.job.id, {
    queue_status: "ready",
    deferred_reason: args.deferredReason,
    error_type:
      args.deferredReason === "lock_conflict" ? "lock_conflict" : null,
    provider_response_summary: args.note,
    locked_at: null,
    locked_by: null,
  });
  await logQueueAudit(args.actorId, args.action, updated, args.note);
  return updated;
}

async function handleExpiredWindow(
  args: QueueExecutionContext & {
    job: CampaignPublishJobRow;
  },
) {
  const updated = await updatePublishJob(args.admin, args.job.id, {
    queue_status: "failed",
    publish_status: "publish_failed",
    error_message: "Execution window expired before the job could run.",
    last_error: "Execution window expired before the job could run.",
    error_type: "expired_window",
    deferred_reason: null,
    locked_at: null,
    locked_by: null,
    completed_at: args.now.toISOString(),
  });
  await logQueueAudit(
    args.triggeredBy,
    "CAMPAIGN_PUBLISH_ERROR_CLASSIFIED",
    updated,
    "Job expired before reaching its execution window.",
  );
  await logQueueAudit(
    args.triggeredBy,
    "CAMPAIGN_PUBLISH_QUEUE_JOB_FAILED",
    updated,
    "Execution window expired before the job could run.",
  );

  return {
    job: updated,
    summary: buildJobSummary(
      updated,
      "failed",
      "Execution window expired before the job could run.",
    ),
    retryScheduled: false,
  };
}

async function executeQueueJob(
  args: QueueExecutionContext & {
    job: CampaignPublishJobRow;
  },
) {
  const current = await loadPublishJob(args.admin, args.job.id);
  if (["completed", "cancelled", "running"].includes(current.queue_status)) {
    return {
      job: current,
      summary: buildJobSummary(
        current,
        "skipped",
        "Job was no longer runnable when the queue reached it.",
      ),
      retryScheduled: false,
    };
  }

  if (
    current.execution_window_end &&
    new Date(current.execution_window_end).getTime() < args.now.getTime()
  ) {
    return handleExpiredWindow({ ...args, job: current });
  }

  if (current.queue_status !== "ready") {
    await updatePublishJob(args.admin, current.id, {
      queue_status: "ready",
      deferred_reason: null,
      error_type: null,
      provider_response_summary: "Queue job marked ready for execution.",
    });
  }

  const locked = await lockPublishJob({
    admin: args.admin,
    jobId: current.id,
    lockedBy: args.lockOwner,
  });
  if (!locked) {
    const updated = await updatePublishJob(args.admin, current.id, {
      queue_status: "ready",
      error_type: "lock_conflict",
      deferred_reason: "lock_conflict",
      provider_response_summary:
        "Another queue runner is already handling this publish job.",
    });
    await logQueueAudit(
      args.triggeredBy,
      "CAMPAIGN_PUBLISH_ERROR_CLASSIFIED",
      updated,
      "Queue job hit a lock conflict and was deferred.",
    );
    return {
      job: updated,
      summary: buildJobSummary(
        updated,
        "deferred",
        "Queue job was deferred because a lock conflict was detected.",
      ),
      retryScheduled: false,
    };
  }

  await logQueueAudit(
    args.triggeredBy,
    "CAMPAIGN_PUBLISH_QUEUE_JOB_STARTED",
    locked,
    "Queue job started running.",
  );

  const result = await (async () => {
    try {
      return await runPublishJob({
        admin: args.admin,
        jobId: locked.id,
        triggeredBy: args.triggeredBy,
        lockOwner: args.lockOwner,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected queue publish error.";
      const failedJob = await updatePublishJob(args.admin, locked.id, {
        queue_status: "failed",
        publish_status: "publish_failed",
        error_message: message,
        last_error: message,
        deferred_reason: null,
        locked_at: null,
        locked_by: null,
        completed_at: args.now.toISOString(),
      });
      return {
        ok: false,
        job: failedJob,
        errorMessage: message,
      };
    }
  })();

  if (result.ok) {
    await logQueueAudit(
      args.triggeredBy,
      "CAMPAIGN_PUBLISH_QUEUE_JOB_COMPLETED",
      result.job,
      "Queue job completed successfully.",
    );
    return {
      job: result.job,
      summary: buildJobSummary(
        result.job,
        "completed",
        "Queue job completed successfully.",
      ),
      retryScheduled: false,
    };
  }

  const errorType = classifyPublishError(result.errorMessage);
  await logQueueAudit(
    args.triggeredBy,
    "CAMPAIGN_PUBLISH_ERROR_CLASSIFIED",
    result.job,
    `Publish error classified as ${errorType.replace(/_/g, " ")}.`,
    { classifiedErrorType: errorType },
  );

  const nextRetryCount = result.job.retry_count + 1;
  if (
    isRetryableErrorType(errorType) &&
    nextRetryCount <= result.job.max_retries
  ) {
    const retryAt = addMinutes(
      args.now,
      getRetryDelayMinutes(errorType, nextRetryCount),
    );
    const retried = await updatePublishJob(args.admin, result.job.id, {
      queue_status: "scheduled",
      retry_count: nextRetryCount,
      next_retry_at: retryAt,
      error_type: errorType,
      deferred_reason: "retry_deferred",
      provider_response_summary: `Retry ${nextRetryCount}/${result.job.max_retries} scheduled for ${retryAt}.`,
      last_error: result.errorMessage,
      error_message: result.errorMessage,
    });
    await logQueueAudit(
      args.triggeredBy,
      "CAMPAIGN_PUBLISH_RETRY_DEFERRED",
      retried,
      `Retry deferred until ${retryAt}.`,
    );
    await logQueueAudit(
      args.triggeredBy,
      "CAMPAIGN_PUBLISH_RETRY_SCHEDULED",
      retried,
      `Recoverable ${errorType.replace(/_/g, " ")} scheduled retry ${nextRetryCount}/${result.job.max_retries}.`,
    );
    return {
      job: retried,
      summary: buildJobSummary(
        retried,
        "retry_scheduled",
        `Recoverable error. Retry ${nextRetryCount}/${result.job.max_retries} scheduled.`,
      ),
      retryScheduled: true,
    };
  }

  const finalized = await updatePublishJob(args.admin, result.job.id, {
    error_type: errorType,
    deferred_reason: null,
    next_retry_at: null,
  });
  await logQueueAudit(
    args.triggeredBy,
    "CAMPAIGN_PUBLISH_QUEUE_JOB_FAILED",
    finalized,
    result.errorMessage || "Queue job failed.",
  );
  await logQueueAudit(
    args.triggeredBy,
    "CAMPAIGN_PUBLISH_RETRY_EXHAUSTED",
    finalized,
    isRetryableErrorType(errorType)
      ? "Retry policy exhausted or disabled for this failure."
      : `No retry scheduled because ${errorType.replace(/_/g, " ")} is not recoverable.`,
  );

  return {
    job: finalized,
    summary: buildJobSummary(
      finalized,
      "failed",
      result.errorMessage || "Queue job failed.",
    ),
    retryScheduled: false,
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePublishStatus(value: unknown): CampaignPublishStatus {
  return typeof value === "string"
    ? (value as CampaignPublishStatus)
    : "not_ready";
}

function normalizeQueueStatus(value: unknown): CampaignPublishQueueStatus {
  return typeof value === "string"
    ? (value as CampaignPublishQueueStatus)
    : "completed";
}

function normalizeErrorType(
  value: unknown,
): CampaignPublishQueueErrorType | null {
  return typeof value === "string"
    ? (value as CampaignPublishQueueErrorType)
    : null;
}

function normalizeDeferredReason(
  value: unknown,
): CampaignPublishQueueDeferredReason | null {
  return typeof value === "string"
    ? (value as CampaignPublishQueueDeferredReason)
    : null;
}

function mapPublishJob(value: Record<string, unknown>): CampaignPublishJobRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    channel: readString(value.channel) as PublishChannel,
    message_id: readNullableString(value.message_id),
    publish_status: normalizePublishStatus(value.publish_status),
    publish_mode: readString(value.publish_mode) as CampaignPublishMode,
    queue_status: normalizeQueueStatus(value.queue_status),
    provider_name: readString(value.provider_name),
    provider_response_summary: readString(value.provider_response_summary),
    payload: readRecord(value.payload),
    external_reference_id: readNullableString(value.external_reference_id),
    error_message: readNullableString(value.error_message),
    error_type: normalizeErrorType(value.error_type),
    deferred_reason: normalizeDeferredReason(value.deferred_reason),
    scheduled_for: readNullableString(value.scheduled_for),
    execution_window_start: readNullableString(value.execution_window_start),
    execution_window_end: readNullableString(value.execution_window_end),
    retry_count: readNumber(value.retry_count, 0),
    max_retries: readNumber(value.max_retries, 2),
    next_retry_at: readNullableString(value.next_retry_at),
    last_error: readNullableString(value.last_error),
    locked_at: readNullableString(value.locked_at),
    locked_by: readNullableString(value.locked_by),
    triggered_manually: value.triggered_manually === true,
    triggered_by: readNullableString(value.triggered_by),
    triggered_at: readString(value.triggered_at),
    completed_at: readNullableString(value.completed_at),
  };
}

function buildJobSummary(
  job: CampaignPublishJobRow,
  status: QueueRunJobOutcome,
  note: string,
): QueueRunJobSummary {
  return {
    jobId: job.id,
    campaignId: job.campaign_draft_id,
    channel: job.channel,
    status,
    queueStatus: job.queue_status,
    errorType: job.error_type,
    deferredReason: job.deferred_reason,
    note,
  };
}

function parseOptionalDate(value?: string | null) {
  if (!value || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }
  return parsed;
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

export { parsePublishTargeting };

export async function scheduleCampaignPublish(
  input: ScheduleCampaignPublishInput,
) {
  await assertCampaignChannelSchedulingAllowed({
    admin: input.admin,
    campaignId: input.campaignId,
    channel: input.channel,
    publishMode: input.publishMode,
  });

  const schedule = validateScheduleWindow({
    scheduledFor: input.scheduledFor || null,
    executionWindowStart: input.executionWindowStart || null,
    executionWindowEnd: input.executionWindowEnd || null,
  });

  const queueStatus = resolveQueueStatus(schedule);
  return createPublishJob(input.admin, {
    campaignId: input.campaignId,
    channel: input.channel,
    messageId: null,
    mode: input.publishMode,
    triggeredBy: input.triggeredBy,
    providerName: input.channel,
    providerResponseSummary:
      queueStatus === "scheduled"
        ? "Publish job scheduled."
        : "Publish job queued for the next run.",
    payload: {
      channel: input.channel,
      targets: input.targeting,
    },
    publishStatus: "ready_to_publish",
    queueStatus,
    scheduledFor: schedule.scheduledFor,
    executionWindowStart: schedule.executionWindowStart,
    executionWindowEnd: schedule.executionWindowEnd,
    maxRetries: input.maxRetries ?? 2,
  });
}

export async function unscheduleCampaignPublishes(input: {
  admin: AdminSupabase;
  campaignId: string;
}) {
  const { data, error } = await input.admin
    .from("campaign_publish_jobs")
    .update({
      queue_status: "cancelled",
      deferred_reason: null,
      error_type: null,
      scheduled_for: null,
      next_retry_at: null,
      locked_at: null,
      locked_by: null,
      last_error: "Scheduling removed by admin.",
      error_message: "Scheduling removed by admin.",
      completed_at: new Date().toISOString(),
    } as never)
    .eq("campaign_draft_id", input.campaignId)
    .in("queue_status", ACTIVE_QUEUE_STATUSES)
    .select("*");

  if (error) {
    throw new Error(error.message || "Failed to unschedule publish jobs.");
  }

  return (Array.isArray(data) ? data : []).map((row) =>
    mapPublishJob(row as Record<string, unknown>),
  );
}

export async function cancelPublishJob(input: {
  admin: AdminSupabase;
  jobId: string;
}) {
  return updatePublishJob(input.admin, input.jobId, {
    queue_status: "cancelled",
    deferred_reason: null,
    error_type: null,
    next_retry_at: null,
    scheduled_for: null,
    locked_at: null,
    locked_by: null,
    last_error: "Publish job cancelled by admin.",
    error_message: "Publish job cancelled by admin.",
    completed_at: new Date().toISOString(),
  });
}

export async function reschedulePublishJob(input: ReschedulePublishJobInput) {
  const current = await loadPublishJob(input.admin, input.jobId);
  await assertCampaignChannelSchedulingAllowed({
    admin: input.admin,
    campaignId: current.campaign_draft_id,
    channel: current.channel,
    publishMode: current.publish_mode,
  });

  const schedule = validateScheduleWindow({
    scheduledFor: input.scheduledFor || null,
    executionWindowStart: input.executionWindowStart || null,
    executionWindowEnd: input.executionWindowEnd || null,
  });
  const queueStatus = resolveQueueStatus(schedule);

  return updatePublishJob(input.admin, input.jobId, {
    queue_status: queueStatus,
    publish_status: "ready_to_publish",
    scheduled_for: schedule.scheduledFor,
    execution_window_start: schedule.executionWindowStart,
    execution_window_end: schedule.executionWindowEnd,
    retry_count: 0,
    max_retries: input.maxRetries ?? current.max_retries,
    next_retry_at: null,
    error_type: null,
    deferred_reason: null,
    error_message: null,
    last_error: null,
    locked_at: null,
    locked_by: null,
    completed_at: null,
    provider_response_summary:
      queueStatus === "scheduled"
        ? "Publish job rescheduled."
        : "Publish job returned to the ready queue.",
  });
}

export async function runPublishJobNow(input: RunPublishJobNowInput) {
  const updated = await updatePublishJob(input.admin, input.jobId, {
    queue_status: "ready",
    triggered_manually: true,
    scheduled_for: null,
    next_retry_at: null,
    locked_at: null,
    locked_by: null,
    deferred_reason: null,
    error_type: null,
    provider_response_summary: "Queue job run manually from admin.",
  });
  await logQueueAudit(
    input.triggeredBy,
    "CAMPAIGN_PUBLISH_QUEUE_JOB_RUN_MANUALLY",
    updated,
    "Queue job run manually from admin.",
  );

  const execution = await executeQueueJob({
    admin: input.admin,
    now: new Date(),
    triggeredBy: input.triggeredBy,
    lockOwner: input.triggeredBy || "queue-admin",
    job: updated,
  });

  return {
    status:
      execution.summary.status === "completed"
        ? "completed"
        : execution.summary.status === "retry_scheduled"
          ? "failed"
          : execution.summary.status === "deferred"
            ? "skipped"
            : execution.summary.status,
    job: execution.job,
  };
}

export async function runDuePublishJobs(input: RunDuePublishJobsInput) {
  const now = new Date();
  const limit = Math.max(1, Math.min(input.limit || 10, 50));
  const lockOwner = input.lockOwner || input.triggeredBy || "publish-queue";
  const source = input.source || "admin";
  const result: PublishQueueRunResult = {
    scanned: 0,
    started: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    retriesScheduled: 0,
    deferred: 0,
    throttled: 0,
    concurrencyBlocked: 0,
    jobs: [],
    processed: 0,
    rescheduled: 0,
  };

  await logAudit({
    actorId: input.triggeredBy,
    action:
      source === "cron"
        ? "CAMPAIGN_PUBLISH_CRON_RUN_DUE_CALLED"
        : "CAMPAIGN_PUBLISH_QUEUE_RUN_TRIGGERED",
    entity: "campaign_publish_jobs",
    meta: {
      note:
        source === "cron"
          ? "Cron-compatible queue trigger called."
          : "Admin triggered a queue run.",
      source,
      limit,
    },
  });

  const runnable = await fetchRunnableJobs(input.admin);
  const dueJobs = runnable.filter((job) => isJobDue(job, now));
  result.scanned = dueJobs.length;

  const { data: runningRows } = await input.admin
    .from("campaign_publish_jobs")
    .select("campaign_draft_id, channel")
    .eq("queue_status", "running");
  const runningByChannel = new Map<PublishChannel, number>();
  const runningByCampaignChannel = new Map<string, number>();
  (Array.isArray(runningRows) ? runningRows : []).forEach((row) => {
    const value = row as { campaign_draft_id?: string; channel?: string };
    const channel = (value.channel || "") as PublishChannel;
    const campaignId = value.campaign_draft_id || "";
    runningByChannel.set(channel, (runningByChannel.get(channel) || 0) + 1);
    runningByCampaignChannel.set(
      `${campaignId}:${channel}`,
      (runningByCampaignChannel.get(`${campaignId}:${channel}`) || 0) + 1,
    );
  });
  const attemptedByChannel = new Map<PublishChannel, number>();

  for (const job of dueJobs) {
    if (result.started >= limit) {
      result.skipped += 1;
      result.jobs.push(
        buildJobSummary(
          job,
          "skipped",
          "Batch limit reached before this job could start.",
        ),
      );
      continue;
    }

    const limits = PUBLISH_QUEUE_CHANNEL_LIMITS[job.channel];
    const channelRunning = runningByChannel.get(job.channel) || 0;
    const campaignKey = `${job.campaign_draft_id}:${job.channel}`;
    const campaignChannelRunning =
      runningByCampaignChannel.get(campaignKey) || 0;

    if ((attemptedByChannel.get(job.channel) || 0) >= limits.maxPerRun) {
      const deferred = await markDeferred({
        admin: input.admin,
        job,
        actorId: input.triggeredBy,
        deferredReason: "channel_throttled",
        note: `Deferred until the next queue run because ${job.channel} reached its per-run throttle (${limits.maxPerRun}).`,
        action: "CAMPAIGN_PUBLISH_CHANNEL_THROTTLED",
      });
      result.deferred += 1;
      result.throttled += 1;
      result.skipped += 1;
      result.jobs.push(
        buildJobSummary(
          deferred,
          "deferred",
          "Deferred by per-run channel throttle.",
        ),
      );
      continue;
    }

    if (
      channelRunning >= limits.maxRunning ||
      campaignChannelRunning >= limits.maxRunningPerCampaign
    ) {
      const deferred = await markDeferred({
        admin: input.admin,
        job,
        actorId: input.triggeredBy,
        deferredReason: "concurrency_blocked",
        note: `Deferred because ${job.channel} hit the concurrency guard (${limits.maxRunning} total / ${limits.maxRunningPerCampaign} per campaign).`,
        action: "CAMPAIGN_PUBLISH_CONCURRENCY_BLOCKED",
      });
      result.deferred += 1;
      result.concurrencyBlocked += 1;
      result.skipped += 1;
      result.jobs.push(
        buildJobSummary(deferred, "deferred", "Deferred by concurrency guard."),
      );
      continue;
    }

    result.started += 1;
    attemptedByChannel.set(
      job.channel,
      (attemptedByChannel.get(job.channel) || 0) + 1,
    );

    const execution = await executeQueueJob({
      admin: input.admin,
      now,
      triggeredBy: input.triggeredBy,
      lockOwner,
      job,
    });

    result.jobs.push(execution.summary);
    if (execution.summary.status === "completed") {
      result.completed += 1;
    } else if (execution.summary.status === "retry_scheduled") {
      result.failed += 1;
      result.retriesScheduled += 1;
      result.rescheduled += 1;
    } else if (execution.summary.status === "failed") {
      result.failed += 1;
    } else {
      result.skipped += 1;
      if (execution.summary.status === "deferred") {
        result.deferred += 1;
      }
    }
  }

  result.processed = result.started;

  await logAudit({
    actorId: input.triggeredBy,
    action: "CAMPAIGN_PUBLISH_QUEUE_RUN_COMPLETED",
    entity: "campaign_publish_jobs",
    meta: {
      note: `Queue run completed. Started ${result.started}, completed ${result.completed}, failed ${result.failed}.`,
      source,
      limit,
      scanned: result.scanned,
      started: result.started,
      completed: result.completed,
      failed: result.failed,
      skipped: result.skipped,
      retriesScheduled: result.retriesScheduled,
      throttled: result.throttled,
      concurrencyBlocked: result.concurrencyBlocked,
    },
  });

  return result;
}

export async function getPublishQueueHealth(
  admin: AdminSupabase,
): Promise<PublishQueueHealthSummary> {
  const { data, error } = await admin
    .from("campaign_publish_jobs")
    .select(
      "id, channel, queue_status, next_retry_at, deferred_reason, error_type, last_error, completed_at, triggered_at",
    );

  if (error) {
    throw new Error(error.message || "Failed to load publish queue health.");
  }

  const rows = Array.isArray(data)
    ? data.map((row) => row as Record<string, unknown>)
    : [];
  const recentThreshold = new Date(
    Date.now() - FAILED_RECENT_LOOKBACK_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const channels = Object.keys(
    PUBLISH_QUEUE_CHANNEL_LIMITS,
  ) as PublishChannel[];

  const channelSummaries = channels.map((channel) => {
    const channelRows = rows.filter(
      (row) => readString(row.channel) === channel,
    );
    const readyJobs = channelRows.filter((row) =>
      ["queued", "scheduled", "ready"].includes(readString(row.queue_status)),
    ).length;
    const runningJobs = channelRows.filter(
      (row) => readString(row.queue_status) === "running",
    ).length;
    const failedRecently = channelRows.filter((row) => {
      const status = readString(row.queue_status);
      const completedAt =
        readNullableString(row.completed_at) || readString(row.triggered_at);
      return status === "failed" && completedAt >= recentThreshold;
    }).length;
    const retryPendingJobs = channelRows.filter(
      (row) =>
        readString(row.queue_status) === "scheduled" &&
        Boolean(readNullableString(row.next_retry_at)),
    ).length;
    const throttledJobs = channelRows.filter(
      (row) => readNullableString(row.deferred_reason) === "channel_throttled",
    ).length;
    const concurrencyBlockedJobs = channelRows.filter(
      (row) =>
        readNullableString(row.deferred_reason) === "concurrency_blocked",
    ).length;
    const lastErroredRow =
      [...channelRows]
        .filter((row) => readNullableString(row.last_error))
        .sort((left, right) =>
          (
            readNullableString(right.completed_at) ||
            readString(right.triggered_at)
          ).localeCompare(
            readNullableString(left.completed_at) ||
              readString(left.triggered_at),
          ),
        )[0] || null;

    return {
      channel,
      healthStatus: summarizeQueueHealth({
        ready: readyJobs,
        running: runningJobs,
        failedRecently,
        retries: retryPendingJobs,
        throttled: throttledJobs,
        concurrencyBlocked: concurrencyBlockedJobs,
      }),
      readyJobs,
      runningJobs,
      failedRecently,
      retryPendingJobs,
      throttledJobs,
      concurrencyBlockedJobs,
      lastError: lastErroredRow
        ? readNullableString(lastErroredRow.last_error)
        : null,
      lastErrorAt: lastErroredRow
        ? readNullableString(lastErroredRow.completed_at) ||
          readString(lastErroredRow.triggered_at)
        : null,
    };
  });

  const readyJobs = channelSummaries.reduce(
    (sum, row) => sum + row.readyJobs,
    0,
  );
  const runningJobs = channelSummaries.reduce(
    (sum, row) => sum + row.runningJobs,
    0,
  );
  const failedRecently = channelSummaries.reduce(
    (sum, row) => sum + row.failedRecently,
    0,
  );
  const retryPendingJobs = channelSummaries.reduce(
    (sum, row) => sum + row.retryPendingJobs,
    0,
  );
  const throttledJobs = channelSummaries.reduce(
    (sum, row) => sum + row.throttledJobs,
    0,
  );
  const concurrencyBlockedJobs = channelSummaries.reduce(
    (sum, row) => sum + row.concurrencyBlockedJobs,
    0,
  );

  const { data: lastRunRows } = await admin
    .from("audit_log")
    .select("created_at, meta")
    .eq("action", "CAMPAIGN_PUBLISH_QUEUE_RUN_COMPLETED")
    .order("created_at", { ascending: false })
    .limit(1);

  const lastRunRow = Array.isArray(lastRunRows)
    ? (lastRunRows[0] as { created_at?: string; meta?: unknown } | undefined) ||
      null
    : null;
  const lastRunMeta =
    lastRunRow && lastRunRow.meta && typeof lastRunRow.meta === "object"
      ? (lastRunRow.meta as Record<string, unknown>)
      : null;

  return {
    healthStatus: summarizeQueueHealth({
      ready: readyJobs,
      running: runningJobs,
      failedRecently,
      retries: retryPendingJobs,
      throttled: throttledJobs,
      concurrencyBlocked: concurrencyBlockedJobs,
    }),
    readyJobs,
    runningJobs,
    failedRecently,
    retryPendingJobs,
    throttledJobs,
    concurrencyBlockedJobs,
    lastRunDueAt: lastRunRow?.created_at || null,
    lastRunDueSource:
      lastRunMeta && readString(lastRunMeta.source) === "cron"
        ? "cron"
        : lastRunMeta
          ? "admin"
          : null,
    lastRunDueSummary: lastRunMeta
      ? `Started ${readNumber(lastRunMeta.started, 0)}, completed ${readNumber(lastRunMeta.completed, 0)}, failed ${readNumber(lastRunMeta.failed, 0)}.`
      : null,
    channels: channelSummaries,
  };
}
