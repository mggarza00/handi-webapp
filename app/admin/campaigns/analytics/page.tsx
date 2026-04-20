import Link from "next/link";

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
import StateBadge from "@/components/admin/state-badge";
import {
  getCampaignAnalyticsDashboard,
  type MetricDelta,
  type TrendSeries,
} from "@/lib/campaigns/analytics";
import { buildDashboardRecommendations } from "@/lib/campaigns/recommendations";
import {
  coerceAudienceFilter,
  coerceCampaignStatus,
  coerceGoalFilter,
  labelChannel,
  labelDecisionEligibility,
  labelGoal,
} from "@/lib/campaigns/workflow";
import { getCampaignDecisionSummaries } from "@/lib/campaigns/winners";
import { getAdminSupabase } from "@/lib/supabase/admin";

type Search = {
  searchParams: {
    from?: string;
    to?: string;
    status?: string;
    audience?: string;
    goal?: string;
    channel?: string;
    sufficientData?: string;
    winner?: string;
    eligibility?: string;
  };
};

export const dynamic = "force-dynamic";

export default async function AdminCampaignAnalyticsPage({
  searchParams,
}: Search) {
  const from = (searchParams.from || "").toString();
  const to = (searchParams.to || "").toString();
  const status = coerceCampaignStatus(searchParams.status);
  const audience = coerceAudienceFilter(searchParams.audience);
  const goal = coerceGoalFilter(searchParams.goal);
  const channel = ((searchParams.channel || "").toString() || "") as
    | ""
    | "meta"
    | "email"
    | "whatsapp"
    | "push"
    | "landing"
    | "google";
  const sufficientData = normalizeBinaryFilter(searchParams.sufficientData);
  const winner = normalizeBinaryFilter(searchParams.winner);
  const eligibility = normalizeEligibilityFilter(searchParams.eligibility);
  const admin = getAdminSupabase();

  const baseDashboard = await getCampaignAnalyticsDashboard(admin, {
    from,
    to,
    status,
    audience,
    goal,
    channel,
  });

  const baseCampaignIds = baseDashboard.campaign_rows.map((row) => row.id);
  const decisionSummaries = await getCampaignDecisionSummaries(
    admin,
    baseCampaignIds,
  );
  const filteredCampaignIds = baseCampaignIds.filter((campaignId) =>
    matchesDecisionFilters(decisionSummaries.get(campaignId), {
      sufficientData,
      winner,
      eligibility,
    }),
  );

  const dashboard =
    sufficientData || winner || eligibility
      ? await getCampaignAnalyticsDashboard(admin, {
          from,
          to,
          status,
          audience,
          goal,
          channel,
          campaignIds: filteredCampaignIds,
        })
      : baseDashboard;
  const currentDecisionSummaries =
    sufficientData || winner || eligibility
      ? await getCampaignDecisionSummaries(
          admin,
          dashboard.campaign_rows.map((row) => row.id),
        )
      : decisionSummaries;

  const recommendations = buildDashboardRecommendations(dashboard);
  const currentQuery = qs({
    from,
    to,
    status,
    audience,
    goal,
    channel,
    sufficientData,
    winner,
    eligibility,
  });
  const exportBase = currentQuery
    ? `/api/admin/campaigns/analytics/export?${currentQuery}`
    : "/api/admin/campaigns/analytics/export";

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/campaigns"
            className="text-sm text-muted-foreground underline"
          >
            Back to campaigns
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Campaign analytics</h1>
          <p className="text-sm text-muted-foreground">
            Compare current vs previous periods, track trend lines, and only
            surface winner candidates where signal is strong enough.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`${exportBase}&format=json`}>Export JSON</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`${exportBase}&format=csv`}>Export CSV</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 xl:grid-cols-8">
            <Input name="from" type="date" defaultValue={from} />
            <Input name="to" type="date" defaultValue={to} />
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
              name="goal"
              defaultValue={goal}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All goals</option>
              <option value="acquisition">Acquisition</option>
              <option value="activation">Activation</option>
              <option value="conversion">Conversion</option>
              <option value="reactivation">Reactivation</option>
              <option value="awareness">Awareness</option>
              <option value="retention">Retention</option>
              <option value="upsell">Upsell</option>
              <option value="referral">Referral</option>
              <option value="education">Education</option>
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
              <option value="meta">Meta</option>
              <option value="landing">Landing</option>
              <option value="google">Google export</option>
            </select>
            <select
              name="sufficientData"
              defaultValue={sufficientData}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Any data state</option>
              <option value="yes">Sufficient data</option>
              <option value="no">Insufficient data</option>
            </select>
            <select
              name="winner"
              defaultValue={winner}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Winner or not</option>
              <option value="yes">Has winner</option>
              <option value="no">No winner yet</option>
            </select>
            <div className="flex gap-2 xl:col-span-2">
              <select
                name="eligibility"
                defaultValue={eligibility}
                className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Any eligibility</option>
                <option value="eligible">Eligible</option>
                <option value="limited">Limited</option>
                <option value="manual_only">Manual only</option>
                <option value="not_supported">Not supported</option>
              </select>
              <Button type="submit" variant="outline">
                Apply
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Campaigns"
          value={String(dashboard.totals.campaign_count)}
          hint={`${countWith(decisionSummariesToArray(currentDecisionSummaries), (item) => item.hasWinner)} with winner`}
        />
        <MetricCard
          label="Deliveries"
          value={formatInteger(dashboard.totals.deliveries)}
          delta={dashboard.comparison.deltas.deliveries}
        />
        <MetricCard
          label="Opens"
          value={formatInteger(dashboard.totals.opens)}
          delta={dashboard.comparison.deltas.opens}
        />
        <MetricCard
          label="Clicks"
          value={formatInteger(dashboard.totals.clicks)}
          delta={dashboard.comparison.deltas.clicks}
        />
        <MetricCard
          label="Conversions"
          value={formatInteger(dashboard.totals.conversions)}
          delta={dashboard.comparison.deltas.conversions}
          hint={`${formatRate(dashboard.totals.conversion_rate)} conversion rate`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signal reliability</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border p-4 text-sm">
            <div className="font-medium">Overall signal</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StateBadge value={dashboard.signal_overview.signal_quality} />
              <Badge variant="outline">
                {dashboard.signal_overview.automated_event_count} live callbacks
              </Badge>
            </div>
            <p className="mt-2 text-muted-foreground">
              {dashboard.signal_overview.last_callback_at
                ? `Last callback ${new Date(dashboard.signal_overview.last_callback_at).toLocaleString()}`
                : "No live callbacks ingested yet."}
            </p>
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <div className="font-medium">Source mix</div>
            <p className="mt-2 text-muted-foreground">
              {dashboard.signal_overview.sources.length
                ? dashboard.signal_overview.sources.join(", ")
                : "No analytics sources recorded yet."}
            </p>
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <div className="font-medium">Manual footprint</div>
            <p className="mt-2 text-muted-foreground">
              {dashboard.signal_overview.manual_source_count} manual or snapshot
              source(s) currently shape the view.
            </p>
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <div className="font-medium">Sync errors</div>
            <p className="mt-2 text-muted-foreground">
              {dashboard.signal_overview.last_sync_error_at
                ? `${new Date(dashboard.signal_overview.last_sync_error_at).toLocaleString()} | ${dashboard.signal_overview.last_sync_error_message || "Signal processing error"}`
                : "No callback/sync errors recorded."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current vs previous range</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ComparisonCard
            label="CTR"
            delta={dashboard.comparison.deltas.ctr}
            current={formatRate(dashboard.comparison.current.ctr)}
            previous={formatRate(dashboard.comparison.previous.ctr)}
          />
          <ComparisonCard
            label="Open rate"
            delta={dashboard.comparison.deltas.open_rate}
            current={formatRate(dashboard.comparison.current.open_rate)}
            previous={formatRate(dashboard.comparison.previous.open_rate)}
          />
          <ComparisonCard
            label="Conversion rate"
            delta={dashboard.comparison.deltas.conversion_rate}
            current={formatRate(dashboard.comparison.current.conversion_rate)}
            previous={formatRate(dashboard.comparison.previous.conversion_rate)}
          />
          <ComparisonCard
            label="Failures"
            delta={dashboard.comparison.deltas.failures}
            current={formatInteger(dashboard.comparison.current.failures)}
            previous={formatInteger(dashboard.comparison.previous.failures)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Learning loop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.length ? (
              recommendations.map((recommendation) => (
                <div key={recommendation.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{recommendation.scope}</Badge>
                    <Badge
                      variant={
                        recommendation.kind === "warning"
                          ? "destructive"
                          : recommendation.kind === "positive"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {recommendation.kind}
                    </Badge>
                  </div>
                  <div className="mt-2 font-medium">{recommendation.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {recommendation.detail}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Not enough performance data yet to generate recommendations.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trend summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrendCard series={dashboard.publish_job_trend} />
            {dashboard.channel_trends.slice(0, 4).map((series) => (
              <TrendCard key={series.id} series={series} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Audience / Goal</TableHead>
                <TableHead>Decision support</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.campaign_rows.length ? (
                [...dashboard.campaign_rows]
                  .sort(
                    (left, right) =>
                      right.summary.conversions - left.summary.conversions ||
                      right.summary.clicks - left.summary.clicks ||
                      (right.summary.ctr || 0) - (left.summary.ctr || 0),
                  )
                  .slice(0, 12)
                  .map((row) => {
                    const decision = currentDecisionSummaries.get(row.id);
                    const trend =
                      dashboard.campaign_trends.find(
                        (series) => series.id === row.id,
                      ) || null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="space-y-1">
                          <Link
                            href={`/admin/campaigns/${row.id}`}
                            className="font-medium underline underline-offset-2"
                          >
                            {row.title}
                          </Link>
                          <div className="text-sm text-muted-foreground">
                            {row.channel_count} channels
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.audience}</div>
                          <div className="text-sm text-muted-foreground">
                            {labelGoal(row.goal)}
                          </div>
                        </TableCell>
                        <TableCell className="space-y-1">
                          <StateBadge value={row.status} />
                          <StateBadge value={row.publish_status} />
                          {decision ? (
                            <>
                              <StateBadge
                                value={row.signal_summary.signal_quality}
                              />
                              <Badge variant="outline">
                                {labelDecisionEligibility(
                                  decision.decisionEligibility,
                                )}
                              </Badge>
                              <Badge
                                variant={
                                  decision.sufficientData
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {decision.sufficientData
                                  ? "sufficient data"
                                  : "insufficient data"}
                              </Badge>
                              {decision.hasWinner ? (
                                <Badge variant="secondary">
                                  winner selected
                                </Badge>
                              ) : null}
                              {row.signal_summary.last_callback_at ? (
                                <div className="text-xs text-muted-foreground">
                                  Live callback{" "}
                                  {new Date(
                                    row.signal_summary.last_callback_at,
                                  ).toLocaleString()}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <Badge variant="outline">
                              No decision data yet
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="space-y-1 text-sm">
                          <div>
                            Deliveries {formatInteger(row.summary.deliveries)}
                          </div>
                          <div>Clicks {formatInteger(row.summary.clicks)}</div>
                          <div>CTR {formatRate(row.summary.ctr)}</div>
                          <div>
                            Conversions {formatInteger(row.summary.conversions)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {trend ? (
                            <>
                              <StateBadge value={trend.direction} />
                              <div className="mt-1 text-muted-foreground">
                                {trend.summary}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              No trend yet
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(row.updated_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-sm text-muted-foreground"
                  >
                    No campaigns match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top variants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.top_messages.length ? (
              dashboard.top_messages.map((row) => {
                const channelSummary = currentDecisionSummaries
                  .get(row.campaign_draft_id)
                  ?.channelSummaries.find(
                    (item) => item.channel === row.channel,
                  );
                return (
                  <div key={row.message_id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {labelChannel(row.channel)}
                      </Badge>
                      <Badge variant="secondary">{row.variant_name}</Badge>
                      <StateBadge value={row.status} />
                      {channelSummary?.winnerMessageId === row.message_id ? (
                        <Badge variant="secondary">winner</Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                      <MetaLine
                        label="Deliveries"
                        value={formatInteger(row.deliveries)}
                      />
                      <MetaLine
                        label="Clicks"
                        value={formatInteger(row.clicks)}
                      />
                      <MetaLine label="CTR" value={formatRate(row.ctr)} />
                      <MetaLine
                        label="Conversions"
                        value={formatInteger(row.conversions)}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                No variant-level analytics yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent publish jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recent_publish_jobs.length ? (
              dashboard.recent_publish_jobs.slice(0, 12).map((job) => (
                <div key={job.job_id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{labelChannel(job.channel)}</Badge>
                    <StateBadge value={job.publish_status} />
                    <Badge variant="secondary">{job.publish_mode}</Badge>
                  </div>
                  <div className="mt-2 font-medium">{job.campaign_title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {job.message_variant_name || "No message attached"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <StateBadge value={job.signal_quality} />
                    {job.last_callback_at ? (
                      <Badge variant="outline">
                        Live callback{" "}
                        {new Date(job.last_callback_at).toLocaleString()}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No live callback yet</Badge>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                    <MetaLine
                      label="Deliveries"
                      value={formatInteger(job.deliveries)}
                    />
                    <MetaLine
                      label="Clicks"
                      value={formatInteger(job.clicks)}
                    />
                    <MetaLine
                      label="Conversions"
                      value={formatInteger(job.conversions)}
                    />
                  </div>
                  {job.last_sync_error_message ? (
                    <p className="mt-2 text-xs text-amber-700">
                      {job.last_sync_error_message}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No publish jobs recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MetricCard(args: {
  label: string;
  value: string;
  hint?: string;
  delta?: MetricDelta;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {args.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{args.value}</div>
        {args.delta ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDelta(args.delta)}
          </p>
        ) : null}
        {args.hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{args.hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ComparisonCard(args: {
  label: string;
  current: string;
  previous: string;
  delta: MetricDelta;
}) {
  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="font-medium">{args.label}</div>
      <div className="mt-2 text-lg font-semibold">{args.current}</div>
      <div className="text-xs text-muted-foreground">
        Previous {args.previous}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {formatDelta(args.delta)}
      </div>
    </div>
  );
}

function TrendCard({ series }: { series: TrendSeries }) {
  const latest = series.points.at(-1) || null;
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-medium">{series.label}</div>
        <StateBadge value={series.direction} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{series.summary}</p>
      {latest ? (
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
          <MetaLine
            label="Deliveries"
            value={formatInteger(latest.deliveries)}
          />
          <MetaLine label="Opens" value={formatInteger(latest.opens)} />
          <MetaLine label="Clicks" value={formatInteger(latest.clicks)} />
          <MetaLine
            label="Conversions"
            value={formatInteger(latest.conversions)}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No trend points recorded yet.
        </p>
      )}
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div>{value}</div>
    </div>
  );
}

function normalizeBinaryFilter(value: string | undefined) {
  if (value === "yes" || value === "no") return value;
  return "";
}

function normalizeEligibilityFilter(value: string | undefined) {
  if (
    value === "eligible" ||
    value === "limited" ||
    value === "manual_only" ||
    value === "not_supported"
  ) {
    return value;
  }
  return "";
}

function matchesDecisionFilters(
  summary: ReturnType<typeof decisionSummariesToArray>[number] | undefined,
  filters: {
    sufficientData: string;
    winner: string;
    eligibility: string;
  },
) {
  if (!summary) {
    return !filters.sufficientData && !filters.winner && !filters.eligibility;
  }
  if (filters.sufficientData === "yes" && !summary.sufficientData) return false;
  if (filters.sufficientData === "no" && summary.sufficientData) return false;
  if (filters.winner === "yes" && !summary.hasWinner) return false;
  if (filters.winner === "no" && summary.hasWinner) return false;
  if (
    filters.eligibility &&
    summary.decisionEligibility !== filters.eligibility
  ) {
    return false;
  }
  return true;
}

function decisionSummariesToArray(
  summaries: Awaited<ReturnType<typeof getCampaignDecisionSummaries>>,
) {
  return Array.from(summaries.values());
}

function countWith<T>(items: T[], predicate: (item: T) => boolean) {
  return items.filter(predicate).length;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatRate(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(1)}%`;
}

function formatDelta(delta: MetricDelta) {
  if (delta.delta === null) return "No previous comparison.";
  const prefix = delta.direction === "up" ? "+" : "";
  return `${prefix}${delta.delta.toFixed(1)} vs previous period`;
}

function qs(obj: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(obj).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}
