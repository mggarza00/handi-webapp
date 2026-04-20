import Link from "next/link";

import StateBadge from "@/components/admin/state-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listPublishQueueJobs } from "@/lib/campaigns/repository";
import { getPublishQueueHealth } from "@/lib/campaigns/publish-queue";
import {
  labelQueueDeferredReason,
  labelQueueErrorType,
  labelQueueHealthStatus,
} from "@/lib/campaigns/workflow";
import { labelPublishChannel } from "@/lib/publish/index";
import { getAdminSupabase } from "@/lib/supabase/admin";

type Search = {
  searchParams: {
    page?: string;
    q?: string;
    queueStatus?: string;
    channel?: string;
    errorType?: string;
  };
};

export const dynamic = "force-dynamic";

const QUEUE_STATUSES = [
  "",
  "queued",
  "scheduled",
  "ready",
  "running",
  "completed",
  "failed",
  "paused",
  "cancelled",
] as const;
type QueueStatusFilter = (typeof QUEUE_STATUSES)[number];
type QueueChannelFilter =
  | ""
  | "email"
  | "push"
  | "whatsapp"
  | "meta"
  | "landing"
  | "google";
type QueueErrorTypeFilter =
  | ""
  | "recoverable_transient"
  | "recoverable_rate_limited"
  | "configuration_error"
  | "readiness_error"
  | "approval_error"
  | "unsupported_channel"
  | "targeting_error"
  | "expired_window"
  | "lock_conflict"
  | "unknown_error";

export default async function AdminCampaignQueuePage({ searchParams }: Search) {
  const admin = getAdminSupabase();
  const page = Math.max(1, Number(searchParams.page || 1));
  const q = (searchParams.q || "").toString();
  const queueStatus = normalizeQueueStatus(searchParams.queueStatus);
  const channel = normalizeChannel(searchParams.channel);
  const errorType = normalizeErrorType(searchParams.errorType);
  const [result, health] = await Promise.all([
    listPublishQueueJobs(admin, {
      page,
      pageSize: 20,
      q,
      queueStatus,
      channel,
      errorType,
    }),
    getPublishQueueHealth(admin),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const currentQuery = qs({
    q,
    queueStatus,
    channel,
    errorType,
  });
  const redirectTarget = currentQuery
    ? `/admin/campaigns/queue?${currentQuery}`
    : "/admin/campaigns/queue";

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Publish queue</h1>
          <p className="text-sm text-muted-foreground">
            Schedule, run, and recover internal publish jobs without external
            workers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/campaigns">Campaigns</Link>
          </Button>
          <form action="/api/admin/publish-jobs/run-due" method="post">
            <input type="hidden" name="redirectTo" value={redirectTarget} />
            <Button type="submit">Run due jobs</Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StateBadge value={health.healthStatus} />
            <Badge variant="outline">
              {labelQueueHealthStatus(health.healthStatus)}
            </Badge>
            <Badge variant="secondary">Ready {health.readyJobs}</Badge>
            <Badge variant="secondary">Running {health.runningJobs}</Badge>
            <Badge variant="outline">
              Retries pending {health.retryPendingJobs}
            </Badge>
            <Badge variant={health.failedRecently ? "destructive" : "outline"}>
              Failed recently {health.failedRecently}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {health.channels.map((item) => (
              <div key={item.channel} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">
                    {labelPublishChannel(item.channel)}
                  </div>
                  <StateBadge value={item.healthStatus} />
                </div>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <div>Ready {item.readyJobs}</div>
                  <div>Running {item.runningJobs}</div>
                  <div>Failed {item.failedRecently}</div>
                  <div>Retries {item.retryPendingJobs}</div>
                  {item.lastError ? (
                    <div className="text-amber-700">{item.lastError}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="text-sm text-muted-foreground">
            {health.lastRunDueAt
              ? `Last run ${new Date(health.lastRunDueAt).toLocaleString()} via ${health.lastRunDueSource || "admin"}. ${health.lastRunDueSummary || ""}`
              : "No queue run recorded yet."}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queue filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-5">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search campaign or variant"
            />
            <select
              name="queueStatus"
              defaultValue={queueStatus}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All queue states</option>
              {QUEUE_STATUSES.filter(Boolean).map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              name="channel"
              defaultValue={channel}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All channels</option>
              <option value="email">Email</option>
              <option value="push">Push</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="meta">Meta ads</option>
              <option value="landing">Landing</option>
              <option value="google">Google ads</option>
            </select>
            <select
              name="errorType"
              defaultValue={errorType}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All error types</option>
              <option value="recoverable_transient">
                Recoverable transient
              </option>
              <option value="recoverable_rate_limited">
                Recoverable rate limited
              </option>
              <option value="configuration_error">Configuration error</option>
              <option value="readiness_error">Readiness error</option>
              <option value="approval_error">Approval error</option>
              <option value="unsupported_channel">Unsupported channel</option>
              <option value="targeting_error">Targeting error</option>
              <option value="expired_window">Expired window</option>
              <option value="lock_conflict">Lock conflict</option>
              <option value="unknown_error">Unknown error</option>
            </select>
            <Button type="submit" variant="outline">
              Filter
            </Button>
          </form>

          <div className="text-sm text-muted-foreground">
            {result.total} queue jobs
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.length ? (
                result.items.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="space-y-1">
                      <Link
                        href={`/admin/campaigns/${job.campaign_draft_id}`}
                        className="font-medium underline underline-offset-2"
                      >
                        {job.campaign_title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {job.selected_variant_name ||
                          "Variant chosen at run time"}
                      </div>
                    </TableCell>
                    <TableCell className="space-y-1">
                      <Badge variant="outline">
                        {labelPublishChannel(job.channel)}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {job.publish_mode}
                      </div>
                    </TableCell>
                    <TableCell className="space-y-1">
                      <div className="flex flex-wrap gap-2">
                        <StateBadge value={job.queue_status} />
                        <StateBadge value={job.publish_status} />
                        {job.error_type ? (
                          <StateBadge value={job.error_type} />
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Campaign {job.campaign_status.replace(/_/g, " ")} /{" "}
                        {job.campaign_publish_status.replace(/_/g, " ")}
                      </div>
                      {job.deferred_reason ? (
                        <div className="text-xs text-muted-foreground">
                          Deferred:{" "}
                          {labelQueueDeferredReason(job.deferred_reason)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="space-y-1 text-xs text-muted-foreground">
                      <div>
                        Scheduled{" "}
                        {job.scheduled_for
                          ? new Date(job.scheduled_for).toLocaleString()
                          : "ASAP"}
                      </div>
                      {job.next_retry_at ? (
                        <div>
                          Next retry{" "}
                          {new Date(job.next_retry_at).toLocaleString()}
                        </div>
                      ) : null}
                      {job.execution_window_start ||
                      job.execution_window_end ? (
                        <div>
                          Window{" "}
                          {job.execution_window_start
                            ? new Date(
                                job.execution_window_start,
                              ).toLocaleString()
                            : "open"}{" "}
                          to{" "}
                          {job.execution_window_end
                            ? new Date(
                                job.execution_window_end,
                              ).toLocaleString()
                            : "open"}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="space-y-1 text-xs text-muted-foreground">
                      <div>
                        {job.retry_count} / {job.max_retries}
                      </div>
                      {job.error_type ? (
                        <div>{labelQueueErrorType(job.error_type)}</div>
                      ) : null}
                      {job.last_error ? (
                        <div className="max-w-xs text-amber-700">
                          {job.last_error}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.owner_label || "Unassigned"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <form
                          action={`/api/admin/publish-jobs/${job.id}/run-now`}
                          method="post"
                        >
                          <input
                            type="hidden"
                            name="redirectTo"
                            value={redirectTarget}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            disabled={
                              job.queue_status === "completed" ||
                              job.queue_status === "cancelled" ||
                              job.queue_status === "running"
                            }
                          >
                            Run now
                          </Button>
                        </form>
                        <form
                          action={`/api/admin/publish-jobs/${job.id}/cancel`}
                          method="post"
                        >
                          <input
                            type="hidden"
                            name="redirectTo"
                            value={redirectTarget}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            disabled={
                              job.queue_status === "completed" ||
                              job.queue_status === "cancelled" ||
                              job.queue_status === "running"
                            }
                          >
                            Cancel
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-sm text-muted-foreground"
                  >
                    No publish jobs match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {result.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={result.page <= 1}
              >
                <Link
                  href={buildPageHref(result.page - 1, {
                    q,
                    queueStatus,
                    channel,
                    errorType,
                  })}
                >
                  Previous
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={result.page >= totalPages}
              >
                <Link
                  href={buildPageHref(result.page + 1, {
                    q,
                    queueStatus,
                    channel,
                    errorType,
                  })}
                >
                  Next
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function normalizeQueueStatus(value: string | undefined) {
  const candidate = (value || "").toString();
  return QUEUE_STATUSES.includes(candidate as (typeof QUEUE_STATUSES)[number])
    ? (candidate as QueueStatusFilter)
    : "";
}

function normalizeChannel(value: string | undefined) {
  const candidate = (value || "").toString();
  return [
    "",
    "email",
    "push",
    "whatsapp",
    "meta",
    "landing",
    "google",
  ].includes(candidate)
    ? (candidate as QueueChannelFilter)
    : "";
}

function normalizeErrorType(value: string | undefined) {
  const candidate = (value || "").toString();
  return [
    "",
    "recoverable_transient",
    "recoverable_rate_limited",
    "configuration_error",
    "readiness_error",
    "approval_error",
    "unsupported_channel",
    "targeting_error",
    "expired_window",
    "lock_conflict",
    "unknown_error",
  ].includes(candidate)
    ? (candidate as QueueErrorTypeFilter)
    : ("" as QueueErrorTypeFilter);
}

function qs(values: Record<string, string>) {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return search.toString();
}

function buildPageHref(page: number, values: Record<string, string>) {
  const search = new URLSearchParams(qs(values));
  search.set("page", String(page));
  return `/admin/campaigns/queue?${search.toString()}`;
}
