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
import { Textarea } from "@/components/ui/textarea";
import {
  listCampaignDrafts,
  listReviewerOptions,
} from "@/lib/campaigns/repository";
import {
  coerceAudienceFilter,
  coerceCampaignSortOrder,
  coerceCampaignStatus,
  coerceChannelFilter,
  coerceGoalFilter,
  coercePublishStatus,
  labelGoal,
} from "@/lib/campaigns/workflow";
import { getAdminSupabase } from "@/lib/supabase/admin";

type Search = {
  searchParams: {
    page?: string;
    q?: string;
    status?: string;
    audience?: string;
    channel?: string;
    goal?: string;
    publishStatus?: string;
    owner?: string;
    sort?: string;
  };
};

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage({ searchParams }: Search) {
  const page = Math.max(1, Number(searchParams.page || 1));
  const q = (searchParams.q || "").toString();
  const status = coerceCampaignStatus(searchParams.status);
  const audience = coerceAudienceFilter(searchParams.audience);
  const channel = coerceChannelFilter(searchParams.channel);
  const goal = coerceGoalFilter(searchParams.goal);
  const publishStatus = coercePublishStatus(searchParams.publishStatus);
  const owner = (searchParams.owner || "").toString();
  const sort = coerceCampaignSortOrder(searchParams.sort);
  const admin = getAdminSupabase();
  const reviewerOptions = await listReviewerOptions(admin);
  const result = await listCampaignDrafts(admin, {
    page,
    pageSize: 20,
    q,
    status,
    audience,
    channel,
    goal,
    publishStatus,
    owner: owner === "unassigned" ? "unassigned" : owner,
    sort,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const currentQuery = qs({
    q,
    status,
    audience,
    channel,
    goal,
    publishStatus,
    owner,
    sort,
  });
  const redirectTarget = currentQuery
    ? `/admin/campaigns?${currentQuery}`
    : "/admin/campaigns";
  const showDevSeed =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEV_SEED === "1";

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Review AI proposals, compare versions, and move campaigns through
            internal approval without publishing externally.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/campaigns/analytics">Analytics</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/campaigns/new">New brief</Link>
          </Button>
        </div>
      </div>

      {showDevSeed ? (
        <Card>
          <CardHeader>
            <CardTitle>Local demo data</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <form
              action="/api/dev/seed-campaigns"
              method="post"
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="redirectTo" value={redirectTarget} />
              <input type="hidden" name="action" value="seed" />
              <div className="text-sm text-muted-foreground">
                Seeds realistic Handi campaign drafts with edits, regenerations,
                feedback, and varied statuses.
              </div>
              <Button type="submit" variant="outline">
                Seed demo campaigns
              </Button>
            </form>
            <form
              action="/api/dev/seed-campaigns"
              method="post"
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="redirectTo" value={redirectTarget} />
              <input type="hidden" name="action" value="reset" />
              <Button type="submit" variant="ghost">
                Reset seeded campaigns
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Campaign queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-8">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search campaign title"
            />
            <select
              name="status"
              defaultValue={status}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="proposed">Proposed</option>
              <option value="changes_requested">Changes requested</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
            <select
              name="audience"
              defaultValue={audience}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All audiences</option>
              <option value="client">Client</option>
              <option value="professional">Professional</option>
              <option value="business">Business</option>
            </select>
            <select
              name="channel"
              defaultValue={channel}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All channels</option>
              <option value="meta">Meta ads</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="push">Push</option>
              <option value="landing">Landing</option>
            </select>
            <select
              name="goal"
              defaultValue={goal}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All goals</option>
              <option value="acquisition">Acquisition</option>
              <option value="activation">Activation</option>
              <option value="reactivation">Reactivation</option>
              <option value="conversion">Conversion</option>
              <option value="awareness">Awareness</option>
              <option value="retention">Retention</option>
              <option value="upsell">Upsell</option>
              <option value="referral">Referral</option>
              <option value="education">Education</option>
            </select>
            <select
              name="publishStatus"
              defaultValue={publishStatus}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All publish states</option>
              <option value="not_ready">Not ready</option>
              <option value="ready_to_publish">Ready to publish</option>
              <option value="publishing">Publishing</option>
              <option value="published">Published</option>
              <option value="publish_failed">Publish failed</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
            <select
              name="owner"
              defaultValue={owner}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All owners</option>
              <option value="unassigned">Unassigned</option>
              {reviewerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2 md:col-span-2">
              <select
                name="sort"
                defaultValue={sort}
                className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="updated_desc">Newest activity</option>
                <option value="updated_asc">Oldest activity</option>
              </select>
              <Button type="submit" variant="outline">
                Filter
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {result.total} results
              {goal ? ` in ${labelGoal(goal)}` : ""}
            </span>
            <span>Sorted by updated_at</span>
          </div>

          <form
            action="/api/admin/campaigns/batch"
            method="post"
            className="space-y-4"
          >
            <input type="hidden" name="redirectTo" value={redirectTarget} />

            <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[220px_1fr_auto]">
              <select
                name="action"
                defaultValue="approve"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="approve">Approve selected</option>
                <option value="reject">Reject selected</option>
                <option value="archive">Archive selected</option>
              </select>
              <Textarea
                name="note"
                rows={2}
                placeholder="Optional note for the batch action"
              />
              <Button type="submit" variant="outline">
                Apply batch action
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Pick</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Audience / Goal</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>People</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.length ? (
                  result.items.map((draft) => (
                    <TableRow key={draft.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          name="campaignIds"
                          value={draft.id}
                          aria-label={`Select ${draft.title}`}
                        />
                      </TableCell>
                      <TableCell className="space-y-1">
                        <Link
                          href={`/admin/campaigns/${draft.id}`}
                          className="font-medium underline underline-offset-2"
                        >
                          {draft.title}
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {draft.service_category}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {draft.source_campaign_title ? (
                            <Badge variant="outline">
                              From {draft.source_campaign_title}
                            </Badge>
                          ) : null}
                          {draft.has_manual_edits ? (
                            <Badge variant="outline">Manual edit</Badge>
                          ) : null}
                          {draft.has_regenerated_variants ? (
                            <Badge variant="secondary">Regenerated</Badge>
                          ) : null}
                          {draft.change_request_count > 0 ? (
                            <Badge variant="outline">
                              {draft.change_request_count} change request
                              {draft.change_request_count > 1 ? "s" : ""}
                            </Badge>
                          ) : null}
                          <Badge
                            variant={
                              draft.qa_report.qa_status === "ready_for_review"
                                ? "secondary"
                                : draft.qa_report.qa_status === "high_risk"
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            QA {draft.qa_report.overall_score}
                          </Badge>
                          <StateBadge value={draft.publish_status} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{draft.audience}</div>
                        <div className="text-sm text-muted-foreground">
                          {labelGoal(draft.goal)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {draft.channels.map((item) => (
                            <Badge key={item} variant="secondary">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <StateBadge value={draft.status} />
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">
                              {draft.provider_metadata.generationMode === "live"
                                ? "Live"
                                : draft.provider_metadata.generationMode ===
                                    "fallback"
                                  ? "Fallback"
                                  : "Mock"}
                            </Badge>
                            <Badge variant="outline">
                              {draft.generation_provider}
                            </Badge>
                            {draft.provider_metadata.model ? (
                              <Badge variant="secondary">
                                {draft.provider_metadata.model}
                              </Badge>
                            ) : null}
                          </div>
                          {draft.generation_provider_status ? (
                            <div className="text-xs text-muted-foreground">
                              {draft.generation_provider_status}
                            </div>
                          ) : null}
                          {draft.provider_metadata.fallbackReason ? (
                            <div className="text-xs text-amber-700">
                              {draft.provider_metadata.fallbackReason}
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-1 pt-1">
                            <StateBadge value={draft.publish_status} />
                            <StateBadge value={draft.qa_report.qa_status} />
                            <StateBadge
                              value={draft.qa_report.reviewer_priority}
                            />
                            {draft.qa_report.warnings.length ? (
                              <Badge variant="outline">
                                {draft.qa_report.warnings.length} warning
                                {draft.qa_report.warnings.length === 1
                                  ? ""
                                  : "s"}
                              </Badge>
                            ) : null}
                          </div>
                          {draft.last_publish_error ? (
                            <div className="text-xs text-amber-700">
                              {draft.last_publish_error}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {draft.variant_count} variant
                          {draft.variant_count === 1 ? "" : "s"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {draft.offer}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {draft.publish_job_count} publish job
                          {draft.publish_job_count === 1 ? "" : "s"}
                          {draft.last_publish_at
                            ? ` | last ${new Date(draft.last_publish_at).toLocaleString()}`
                            : ""}
                        </div>
                      </TableCell>
                      <TableCell className="space-y-1 text-sm">
                        <div>
                          <span className="font-medium">Owner:</span>{" "}
                          {draft.owner_label || "Unassigned"}
                        </div>
                        <div className="text-muted-foreground">
                          Created by {draft.created_by_label || "system"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(draft.last_activity_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-sm text-muted-foreground"
                    >
                      No campaigns match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </form>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {result.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`?${qs({
                    q,
                    status,
                    audience,
                    channel,
                    goal,
                    publishStatus,
                    owner,
                    sort,
                    page: String(page - 1),
                  })}`}
                  className="rounded-md border border-input px-3 py-1"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`?${qs({
                    q,
                    status,
                    audience,
                    channel,
                    goal,
                    publishStatus,
                    owner,
                    sort,
                    page: String(page + 1),
                  })}`}
                  className="rounded-md border border-input px-3 py-1"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function qs(obj: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(obj).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}
