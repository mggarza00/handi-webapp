import Link from "next/link";
import { notFound } from "next/navigation";

import StateBadge from "@/components/admin/state-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCampaignAnalyticsDetail } from "@/lib/campaigns/analytics";
import { getCampaignDetail } from "@/lib/campaigns/repository";
import { buildCampaignRecommendations } from "@/lib/campaigns/recommendations";
import {
  CAMPAIGN_VARIANT_DECISION_STATUSES,
  REVIEW_CHECKLIST_FIELDS,
  labelChannel,
  labelDecisionEligibility,
  labelDecisionStatus,
  labelChecklistField,
  labelGoal,
  labelPublishStatus,
} from "@/lib/campaigns/workflow";
import {
  getPublishableChannels,
  labelPublishChannel,
} from "@/lib/publish/index";
import { getAdminSupabase } from "@/lib/supabase/admin";
import createClient from "@/utils/supabase/server";
import { buildCampaignDecisionSummaries } from "@/lib/campaigns/winners";

type Ctx = {
  params: { id: string };
  searchParams: {
    from?: string;
    to?: string;
  };
};

export const dynamic = "force-dynamic";

export default async function AdminCampaignDetailPage({
  params,
  searchParams,
}: Ctx) {
  const admin = getAdminSupabase();
  const from = (searchParams.from || "").toString();
  const to = (searchParams.to || "").toString();
  const [detail, analytics] = await Promise.all([
    getCampaignDetail(admin, params.id),
    getCampaignAnalyticsDetail(admin, params.id, { from, to }),
  ]);

  if (!detail) return notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id || "";
  const ownerLabel = detail.draft.owner_user_id
    ? detail.actorNames[detail.draft.owner_user_id] ||
      detail.draft.owner_user_id.slice(0, 8)
    : null;
  const createdByLabel = detail.draft.created_by
    ? detail.actorNames[detail.draft.created_by] ||
      detail.draft.created_by.slice(0, 8)
    : "system";
  const checklistCompleted = Object.values(
    detail.draft.campaign_review_checklist,
  ).filter(Boolean).length;

  const versionsByMessage = new Map(
    detail.messages.map((message) => [
      message.id,
      detail.versions
        .filter((version) => version.campaign_message_id === message.id)
        .sort((left, right) => left.version_number - right.version_number),
    ]),
  );
  const messagesByChannel = new Map<string, typeof detail.messages>();
  detail.messages.forEach((message) => {
    const current = messagesByChannel.get(message.channel) || [];
    current.push(message);
    messagesByChannel.set(message.channel, current);
  });
  const channelEntries = Array.from(messagesByChannel.entries()) as Array<
    [(typeof detail.messages)[number]["channel"], typeof detail.messages]
  >;
  const brand = detail.draft.brand_context;
  const publishableChannels = getPublishableChannels(detail.draft.channels);
  const recommendations = buildCampaignRecommendations({
    draft: detail.draft,
    analytics,
  });
  const decisionSummaries = buildCampaignDecisionSummaries({
    decisions: detail.variantDecisions,
    messages: detail.messages,
  });
  const decisionSummary = decisionSummaries.get(detail.draft.id) || null;
  const decisionByMessageId = new Map(
    detail.variantDecisions.map((decision) => [
      decision.campaign_message_id,
      decision,
    ]),
  );
  const messagePerformanceById = new Map(
    analytics.message_breakdown.map((row) => [row.message_id, row]),
  );
  const publishPerformanceByJobId = new Map(
    analytics.publish_job_breakdown.map((row) => [row.job_id, row]),
  );
  const exportBase = `/api/admin/campaigns/analytics/export?campaignId=${detail.draft.id}${from ? `&from=${encodeURIComponent(from)}` : ""}${to ? `&to=${encodeURIComponent(to)}` : ""}`;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/admin/campaigns"
            className="text-sm text-muted-foreground underline"
          >
            Back to campaigns
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{detail.draft.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StateBadge value={detail.draft.status} />
              <StateBadge value={detail.draft.publish_status} />
              <Badge variant="outline">{detail.draft.audience}</Badge>
              <Badge variant="outline">{labelGoal(detail.draft.goal)}</Badge>
              <ProviderMetaBadges
                providerName={detail.draft.generation_provider}
                generationMode={detail.draft.provider_metadata.generationMode}
                model={detail.draft.provider_metadata.model}
              />
              {detail.draft.channels.map((channel) => (
                <Badge key={channel} variant="secondary">
                  {labelChannel(channel)}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/campaigns/new?from=${detail.draft.id}`}>
              Duplicate campaign
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Campaign summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <MetaLine
              label="Service category"
              value={detail.draft.service_category}
            />
            <MetaLine label="Offer" value={detail.draft.offer} />
            <MetaLine label="CTA" value={detail.draft.cta} />
            <MetaLine
              label="Journey trigger"
              value={detail.draft.journey_trigger || "No explicit trigger"}
            />
            <MetaLine label="Created by" value={createdByLabel} />
            <MetaLine label="Owner" value={ownerLabel || "Unassigned"} />
            <MetaLine
              label="Created"
              value={new Date(detail.draft.created_at).toLocaleString()}
            />
            <MetaLine
              label="Updated"
              value={new Date(detail.draft.updated_at).toLocaleString()}
            />
            {detail.draft.owner_assigned_at ? (
              <MetaLine
                label="Owner assigned"
                value={new Date(
                  detail.draft.owner_assigned_at,
                ).toLocaleString()}
              />
            ) : null}
            {detail.sourceCampaign ? (
              <div>
                <div className="font-medium">Source campaign</div>
                <Link
                  href={`/admin/campaigns/${detail.sourceCampaign.id}`}
                  className="text-muted-foreground underline underline-offset-2"
                >
                  {detail.sourceCampaign.title}
                </Link>
              </div>
            ) : null}
            <div className="md:col-span-2">
              <div className="font-medium">Notes</div>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {detail.draft.notes || "No extra notes."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="font-medium">Recommended angle</div>
              <p className="text-muted-foreground">
                {detail.draft.recommended_angle}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="font-medium">Rationale summary</div>
              <p className="mt-2 text-muted-foreground">
                {detail.draft.rationale_summary}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="font-medium">Generation provider</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <ProviderMetaBadges
                  providerName={detail.draft.generation_provider}
                  generationMode={detail.draft.provider_metadata.generationMode}
                  model={detail.draft.provider_metadata.model}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {detail.draft.generation_provider_status ||
                  "No provider status note recorded."}
              </p>
              {detail.draft.provider_metadata.fallbackReason ? (
                <p className="mt-2 text-xs text-amber-700">
                  Fallback: {detail.draft.provider_metadata.fallbackReason}
                </p>
              ) : null}
              {detail.draft.provider_metadata.requestId ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Request ID: {detail.draft.provider_metadata.requestId}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>QA summary</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Automatic QA helps prioritize review. It does not replace human
              approval.
            </p>
          </div>
          <form
            action={`/api/admin/campaigns/${detail.draft.id}/reanalyze`}
            method="post"
          >
            <input
              type="hidden"
              name="redirectTo"
              value={`/admin/campaigns/${detail.draft.id}`}
            />
            <Button type="submit" variant="outline">
              Reanalyze QA
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StateBadge value={detail.draft.qa_report.qa_status} />
            <StateBadge value={detail.draft.qa_report.reviewer_priority} />
            <Badge variant="outline">
              Overall score {detail.draft.qa_report.overall_score}
            </Badge>
            <Badge
              variant={
                detail.draft.qa_report.ready_for_review
                  ? "secondary"
                  : "outline"
              }
            >
              {detail.draft.qa_report.ready_for_review
                ? "Ready for review"
                : detail.draft.qa_report.qa_status === "high_risk"
                  ? "High risk"
                  : "Needs attention"}
            </Badge>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            {detail.draft.qa_report.summary}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="font-medium">
                Warnings ({detail.draft.qa_report.warnings.length})
              </div>
              {detail.draft.qa_report.warnings.length ? (
                detail.draft.qa_report.warnings.map((warning) => (
                  <div key={warning} className="rounded-lg border p-3 text-sm">
                    {warning}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No campaign-level warnings detected.
                </p>
              )}
            </div>
            <div className="space-y-3">
              <div className="font-medium">
                Suggestions ({detail.draft.qa_report.suggestions.length})
              </div>
              {detail.draft.qa_report.suggestions.length ? (
                detail.draft.qa_report.suggestions.map((suggestion) => (
                  <div
                    key={suggestion}
                    className="rounded-lg border p-3 text-sm"
                  >
                    {suggestion}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No extra campaign-level suggestions.
                </p>
              )}
            </div>
          </div>
          {detail.draft.qa_report.analyzed_at ? (
            <p className="text-xs text-muted-foreground">
              Last analyzed{" "}
              {new Date(detail.draft.qa_report.analyzed_at).toLocaleString()}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Brand context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MetaLine label="Essence" value={brand.essence} />
            <MetaLine label="Positioning" value={brand.positioning} />
            <MetaLine
              label="Audience insight"
              value={brand.audienceInsights.summary}
            />
            <MetaLine
              label="Voice cues"
              value={brand.voiceSummary.slice(0, 3).join(" | ")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KPI suggestions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {detail.draft.kpi_suggestions.length ? (
              detail.draft.kpi_suggestions.map((item) => (
                <div key={item.metric} className="rounded-lg border p-3">
                  <div className="font-medium">{item.metric}</div>
                  <p className="mt-1 text-muted-foreground">
                    {item.whyItMatters}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Signal: {item.targetSignal}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No KPI suggestions yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channel plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {detail.draft.channel_plan.length ? (
              detail.draft.channel_plan.map((step) => (
                <div
                  key={`${step.step}-${step.channel}`}
                  className="rounded-lg border p-3"
                >
                  <div className="font-medium">
                    Step {step.step} - {labelChannel(step.channel)}
                  </div>
                  <p className="mt-1 text-muted-foreground">{step.purpose}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.format} | {step.timing} | trigger: {step.trigger}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No channel plan recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ownership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action={`/api/admin/campaigns/${detail.draft.id}/assign-owner`}
              method="post"
              className="space-y-3"
            >
              <input
                type="hidden"
                name="redirectTo"
                value={`/admin/campaigns/${detail.draft.id}`}
              />
              <select
                name="ownerUserId"
                defaultValue={detail.draft.owner_user_id || ""}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {detail.reviewerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                    {option.email ? ` (${option.email})` : ""}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="outline">
                  Save owner
                </Button>
                {currentUserId ? (
                  <Button
                    type="submit"
                    name="ownerUserId"
                    value={currentUserId}
                    variant="secondary"
                  >
                    Take ownership
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Editorial checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {checklistCompleted}/{REVIEW_CHECKLIST_FIELDS.length} checks
              completed.
            </div>
            <form
              action={`/api/admin/campaigns/${detail.draft.id}/checklist`}
              method="post"
              className="space-y-3"
            >
              <input
                type="hidden"
                name="redirectTo"
                value={`/admin/campaigns/${detail.draft.id}`}
              />
              <div className="grid gap-3 md:grid-cols-2">
                {REVIEW_CHECKLIST_FIELDS.map((field) => (
                  <label
                    key={field}
                    className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name={field}
                      defaultChecked={
                        detail.draft.campaign_review_checklist[field]
                      }
                    />
                    <span>{labelChecklistField(field)}</span>
                  </label>
                ))}
              </div>
              <Button type="submit" variant="outline">
                Save checklist
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editorial actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <form
            action={`/api/admin/campaigns/${detail.draft.id}/approve`}
            method="post"
            className="space-y-2 rounded-lg border p-3"
          >
            <input
              type="hidden"
              name="redirectTo"
              value={`/admin/campaigns/${detail.draft.id}`}
            />
            <div className="font-medium">Approve</div>
            <Input name="feedback_note" placeholder="Optional note" />
            <Button type="submit" className="w-full">
              Approve campaign
            </Button>
          </form>

          <form
            action={`/api/admin/campaigns/${detail.draft.id}/reject`}
            method="post"
            className="space-y-2 rounded-lg border p-3"
          >
            <input
              type="hidden"
              name="redirectTo"
              value={`/admin/campaigns/${detail.draft.id}`}
            />
            <div className="font-medium">Reject</div>
            <Input name="feedback_note" placeholder="Reason for rejection" />
            <Button type="submit" variant="destructive" className="w-full">
              Reject campaign
            </Button>
          </form>

          <form
            action={`/api/admin/campaigns/${detail.draft.id}/request-changes`}
            method="post"
            className="space-y-2 rounded-lg border p-3"
          >
            <input
              type="hidden"
              name="redirectTo"
              value={`/admin/campaigns/${detail.draft.id}`}
            />
            <div className="font-medium">Request changes</div>
            <Textarea
              name="feedback_note"
              required
              rows={4}
              placeholder="Explain what needs another pass."
            />
            <Button type="submit" variant="outline" className="w-full">
              Request changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <StateBadge value={detail.draft.publish_status} />
              <Badge variant="outline">
                Editorial status {detail.draft.status.replace(/_/g, " ")}
              </Badge>
              <StateBadge value={analytics.signal_summary.signal_quality} />
            </div>
            <div className="space-y-2 text-muted-foreground">
              <p>
                Publishing stays manual and only runs after approval. Supported
                channels can be sent live, drafted, or exported depending on the
                connector.
              </p>
              <p>
                Current state: {labelPublishStatus(detail.draft.publish_status)}
                .
              </p>
            </div>
            {detail.draft.publish_ready_at ? (
              <p className="text-xs text-muted-foreground">
                Ready since{" "}
                {new Date(detail.draft.publish_ready_at).toLocaleString()}
              </p>
            ) : null}
            {detail.draft.published_at ? (
              <p className="text-xs text-muted-foreground">
                Last successful publish{" "}
                {new Date(detail.draft.published_at).toLocaleString()}
              </p>
            ) : null}
            {detail.draft.last_publish_error ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                {detail.draft.last_publish_error}
              </div>
            ) : null}
            <div className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {analytics.signal_summary.automated_event_count} live
                  callbacks
                </Badge>
                <Badge variant="outline">
                  {analytics.signal_summary.manual_source_count} manual/snapshot
                  sources
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {analytics.signal_summary.last_callback_at
                  ? `Last callback ${new Date(analytics.signal_summary.last_callback_at).toLocaleString()}`
                  : "No live callback received yet for this campaign."}
              </p>
              {analytics.signal_summary.last_sync_error_message ? (
                <p className="mt-2 text-xs text-amber-700">
                  {analytics.signal_summary.last_sync_error_message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <form
                action={`/api/admin/campaigns/${detail.draft.id}/mark-ready-to-publish`}
                method="post"
              >
                <input
                  type="hidden"
                  name="redirectTo"
                  value={`/admin/campaigns/${detail.draft.id}`}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={detail.draft.status !== "approved"}
                >
                  Mark ready to publish
                </Button>
              </form>
              <form
                action={`/api/admin/campaigns/${detail.draft.id}/pause`}
                method="post"
              >
                <input
                  type="hidden"
                  name="redirectTo"
                  value={`/admin/campaigns/${detail.draft.id}`}
                />
                <Button type="submit" variant="ghost">
                  Pause
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Publish action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Email can go live when explicit recipients are provided. Push can
              go live only with explicit user IDs and configured VAPID keys.
              WhatsApp, landing, Meta, and Google stay in draft/export mode in
              this phase.
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {publishableChannels.map((connector) => (
                <Badge key={connector.channel} variant="outline">
                  {connector.label}: {connector.supportedModes.join(" / ")}
                </Badge>
              ))}
            </div>
            <form
              action={`/api/admin/campaigns/${detail.draft.id}/publish`}
              method="post"
              className="grid gap-3 md:grid-cols-2"
            >
              <input
                type="hidden"
                name="redirectTo"
                value={`/admin/campaigns/${detail.draft.id}`}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Channel</label>
                <select
                  name="channel"
                  defaultValue={publishableChannels[0]?.channel || ""}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {publishableChannels.map((connector) => (
                    <option key={connector.channel} value={connector.channel}>
                      {connector.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mode</label>
                <select
                  name="publishMode"
                  defaultValue="draft"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="live">Live</option>
                  <option value="draft">Draft</option>
                  <option value="export">Export</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Target emails</label>
                <Textarea
                  name="targetEmails"
                  rows={3}
                  placeholder="Comma or line-separated recipients for live email."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target user IDs</label>
                <Textarea
                  name="targetUserIds"
                  rows={3}
                  placeholder="Comma or line-separated user IDs for live push."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target phone</label>
                <Input
                  name="targetPhone"
                  placeholder="Optional phone for WhatsApp draft/export context."
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={detail.draft.status !== "approved"}
                >
                  Start publish job
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publish history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.publishJobs.length ? (
            detail.publishJobs.map((job) => {
              const jobPerformance = publishPerformanceByJobId.get(job.id);
              return (
                <div key={job.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {labelPublishChannel(job.channel)}
                    </Badge>
                    <StateBadge value={job.publish_status} />
                    <Badge variant="secondary">{job.publish_mode}</Badge>
                    <Badge variant="outline">{job.provider_name}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(job.triggered_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {job.provider_response_summary}
                  </p>
                  {jobPerformance ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">
                        Deliveries {formatInteger(jobPerformance.deliveries)}
                      </Badge>
                      <Badge variant="outline">
                        Clicks {formatInteger(jobPerformance.clicks)}
                      </Badge>
                      <Badge variant="outline">
                        Conversions {formatInteger(jobPerformance.conversions)}
                      </Badge>
                      <StateBadge value={jobPerformance.signal_quality} />
                    </div>
                  ) : null}
                  {jobPerformance?.last_callback_at ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last callback{" "}
                      {new Date(
                        jobPerformance.last_callback_at,
                      ).toLocaleString()}
                    </p>
                  ) : null}
                  {jobPerformance?.last_sync_error_message ? (
                    <p className="mt-2 text-xs text-amber-700">
                      {jobPerformance.last_sync_error_message}
                    </p>
                  ) : null}
                  {job.error_message ? (
                    <p className="mt-2 text-sm text-amber-700">
                      {job.error_message}
                    </p>
                  ) : null}
                  {job.external_reference_id ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      External reference: {job.external_reference_id}
                    </p>
                  ) : null}
                  {job.completed_at ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Completed {new Date(job.completed_at).toLocaleString()}
                    </p>
                  ) : null}
                  {job.publish_status === "publish_failed" ? (
                    <form
                      action={`/api/admin/publish-jobs/${job.id}/retry`}
                      method="post"
                      className="mt-3"
                    >
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={`/admin/campaigns/${detail.draft.id}`}
                      />
                      <Button type="submit" variant="outline">
                        Retry job
                      </Button>
                    </form>
                  ) : null}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      View payload
                    </summary>
                    <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/30 p-3 text-xs">
                      {JSON.stringify(job.payload, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              No publish jobs yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Performance and learning</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Analytics support editorial review. They do not replace human
              judgment.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`${exportBase}&scope=campaigns&format=json`}>
                Export summary JSON
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`${exportBase}&scope=messages&format=csv`}>
                Export variants CSV
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-4">
            <Input name="from" type="date" defaultValue={from} />
            <Input name="to" type="date" defaultValue={to} />
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" variant="outline">
                Compare range
              </Button>
              {from || to ? (
                <Button asChild variant="ghost">
                  <Link href={`/admin/campaigns/${detail.draft.id}`}>
                    Clear range
                  </Link>
                </Button>
              ) : null}
            </div>
          </form>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricTile
              label="Deliveries"
              value={formatInteger(analytics.summary.deliveries)}
              hint={formatDeltaText(analytics.comparison.deltas.deliveries)}
            />
            <MetricTile
              label="Opens"
              value={formatInteger(analytics.summary.opens)}
              hint={formatDeltaText(analytics.comparison.deltas.opens)}
            />
            <MetricTile
              label="Clicks"
              value={formatInteger(analytics.summary.clicks)}
              hint={formatDeltaText(analytics.comparison.deltas.clicks)}
            />
            <MetricTile
              label="Conversions"
              value={formatInteger(analytics.summary.conversions)}
              hint={formatDeltaText(analytics.comparison.deltas.conversions)}
            />
            <MetricTile
              label="Failures"
              value={formatInteger(analytics.summary.failures)}
              hint={formatDeltaText(analytics.comparison.deltas.failures)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium">Signal quality</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <StateBadge value={analytics.signal_summary.signal_quality} />
                <Badge variant="outline">
                  {analytics.signal_summary.automated_event_count} live
                  callbacks
                </Badge>
              </div>
            </div>
            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium">Latest callback</div>
              <p className="mt-2 text-muted-foreground">
                {analytics.signal_summary.last_callback_at
                  ? new Date(
                      analytics.signal_summary.last_callback_at,
                    ).toLocaleString()
                  : "No callback yet"}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium">Sources</div>
              <p className="mt-2 text-muted-foreground">
                {analytics.signal_summary.sources.length
                  ? analytics.signal_summary.sources.join(", ")
                  : "No sources recorded yet."}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium">Last sync error</div>
              <p className="mt-2 text-muted-foreground">
                {analytics.signal_summary.last_sync_error_message ||
                  "No sync errors recorded."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current vs previous</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ComparisonLine
                  label="CTR"
                  current={formatRate(analytics.comparison.current.ctr)}
                  previous={formatRate(analytics.comparison.previous.ctr)}
                  delta={analytics.comparison.deltas.ctr}
                />
                <ComparisonLine
                  label="Open rate"
                  current={formatRate(analytics.comparison.current.open_rate)}
                  previous={formatRate(analytics.comparison.previous.open_rate)}
                  delta={analytics.comparison.deltas.open_rate}
                />
                <ComparisonLine
                  label="Conversion rate"
                  current={formatRate(
                    analytics.comparison.current.conversion_rate,
                  )}
                  previous={formatRate(
                    analytics.comparison.previous.conversion_rate,
                  )}
                  delta={analytics.comparison.deltas.conversion_rate}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trend summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <TrendSummaryCard series={analytics.campaign_trend} />
                {analytics.channel_trends.slice(0, 2).map((series) => (
                  <TrendSummaryCard key={series.id} series={series} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Decision support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {decisionSummary ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {labelDecisionEligibility(
                          decisionSummary.decisionEligibility,
                        )}
                      </Badge>
                      <Badge
                        variant={
                          decisionSummary.sufficientData
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {decisionSummary.sufficientData
                          ? "sufficient data"
                          : "insufficient data"}
                      </Badge>
                      {decisionSummary.hasWinner ? (
                        <Badge variant="secondary">winner selected</Badge>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {decisionSummary.channelSummaries.map((summary) => (
                        <div
                          key={summary.channel}
                          className="rounded-lg border p-3"
                        >
                          <div className="font-medium">
                            {labelChannel(summary.channel)}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {summary.winnerVariantName
                              ? `Winner: ${summary.winnerVariantName}`
                              : summary.sufficientDataReason ||
                                "No explicit winner yet."}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No decision support rows recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendations.length ? (
                  recommendations.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{item.scope}</Badge>
                        <Badge
                          variant={
                            item.kind === "warning"
                              ? "destructive"
                              : item.kind === "positive"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {item.kind}
                        </Badge>
                      </div>
                      <div className="mt-2 font-medium">{item.title}</div>
                      <p className="mt-1 text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not enough post-publish data yet to generate
                    recommendations.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Channel performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.channel_breakdown.length ? (
                  analytics.channel_breakdown.map((row) => (
                    <div
                      key={row.channel}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {labelChannel(row.channel)}
                        </Badge>
                        <StateBadge value={row.signal_quality} />
                        <Badge variant="secondary">
                          CTR {formatRate(row.ctr)}
                        </Badge>
                        <Badge variant="secondary">
                          Open {formatRate(row.open_rate)}
                        </Badge>
                        <Badge variant="secondary">
                          Conv {formatRate(row.conversion_rate)}
                        </Badge>
                        {decisionSummary?.channelSummaries.find(
                          (summary) => summary.channel === row.channel,
                        ) ? (
                          <Badge variant="outline">
                            {decisionSummary.channelSummaries.find(
                              (summary) => summary.channel === row.channel,
                            )?.winnerVariantName || "No winner"}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-4">
                        <MetaLine
                          label="Deliveries"
                          value={formatInteger(row.deliveries)}
                        />
                        <MetaLine
                          label="Clicks"
                          value={formatInteger(row.clicks)}
                        />
                        <MetaLine
                          label="Conversions"
                          value={formatInteger(row.conversions)}
                        />
                        <MetaLine
                          label="Failures"
                          value={formatInteger(row.failures)}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {row.last_callback_at
                          ? `Last callback ${new Date(row.last_callback_at).toLocaleString()}`
                          : "No live callback yet for this channel."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No performance snapshots yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Variant performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.message_breakdown.length ? (
                  analytics.message_breakdown.map((row) => (
                    <div
                      key={row.message_id}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {labelChannel(row.channel)}
                        </Badge>
                        <Badge variant="secondary">{row.variant_name}</Badge>
                        <StateBadge value={row.status} />
                        <StateBadge value={row.signal_quality} />
                        {decisionByMessageId.get(row.message_id) ? (
                          <>
                            <StateBadge
                              value={
                                decisionByMessageId.get(row.message_id)!
                                  .decision_status
                              }
                            />
                            <Badge variant="outline">
                              {labelDecisionEligibility(
                                decisionByMessageId.get(row.message_id)!
                                  .decision_eligibility,
                              )}
                            </Badge>
                          </>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-4">
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
                      <p className="mt-2 text-xs text-muted-foreground">
                        {row.last_callback_at
                          ? `Last callback ${new Date(row.last_callback_at).toLocaleString()}`
                          : row.signal_quality === "manual"
                            ? "Performance currently comes from manual or snapshot data."
                            : "No live callback yet for this variant."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No variant-level performance data yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.recent_events.length ? (
                  analytics.recent_events.slice(0, 12).map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {labelChannel(event.channel)}
                        </Badge>
                        <Badge variant="secondary">{event.event_type}</Badge>
                        <Badge variant="outline">x{event.event_count}</Badge>
                      </div>
                      <p className="mt-2 text-muted-foreground">
                        Source {event.source}
                        {event.target_identifier
                          ? ` | target ${event.target_identifier}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(event.occurred_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No funnel events recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {channelEntries.map(([channel, messages]) => (
        <section key={channel} className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{labelChannel(channel)}</h2>
            <Badge variant="secondary">{messages.length} variants</Badge>
            {decisionSummary?.channelSummaries.find(
              (summary) => summary.channel === channel,
            )?.winnerVariantName ? (
              <Badge variant="outline">
                Winner:{" "}
                {
                  decisionSummary.channelSummaries.find(
                    (summary) => summary.channel === channel,
                  )?.winnerVariantName
                }
              </Badge>
            ) : null}
          </div>

          <div className="space-y-4">
            {messages.map((message) => {
              const versions = versionsByMessage.get(message.id) || [];
              const messagePerformance = messagePerformanceById.get(message.id);
              const decision = decisionByMessageId.get(message.id) || null;
              return (
                <Card key={message.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                      <span>{message.variant_name}</span>
                      <Badge variant="outline">{message.format}</Badge>
                      <StateBadge value={message.status} />
                      <ProviderMetaBadges
                        providerName={message.provider_metadata.providerName}
                        generationMode={
                          message.provider_metadata.generationMode
                        }
                        model={message.provider_metadata.model}
                      />
                      {message.has_manual_edits ? (
                        <Badge variant="outline">Manual edit</Badge>
                      ) : null}
                      {message.has_regenerated_variants ? (
                        <Badge variant="secondary">Regenerated</Badge>
                      ) : null}
                      {messagePerformance ? (
                        <>
                          <Badge variant="outline">
                            CTR {formatRate(messagePerformance.ctr)}
                          </Badge>
                          <Badge variant="outline">
                            Conv {formatInteger(messagePerformance.conversions)}
                          </Badge>
                        </>
                      ) : null}
                      {decision ? (
                        <>
                          <StateBadge value={decision.decision_status} />
                          <Badge variant="outline">
                            {labelDecisionEligibility(
                              decision.decision_eligibility,
                            )}
                          </Badge>
                        </>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                      <div className="space-y-4">
                        <MessageCopyCard
                          title="Current copy"
                          headline={message.content.headline}
                          body={message.content.body}
                          cta={message.content.cta}
                        />

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              QA scores
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="flex flex-wrap gap-2">
                              <StateBadge value={message.qa_report.qa_status} />
                              <StateBadge
                                value={message.qa_report.reviewer_priority}
                              />
                              <Badge variant="outline">
                                Overall {message.qa_report.overall_score}
                              </Badge>
                              <Badge variant="outline">
                                Risk {message.qa_report.risk_score}
                              </Badge>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <MetaLine
                                label="Brand fit"
                                value={String(
                                  message.qa_report.brand_fit_score,
                                )}
                              />
                              <MetaLine
                                label="Clarity"
                                value={String(message.qa_report.clarity_score)}
                              />
                              <MetaLine
                                label="CTA"
                                value={String(message.qa_report.cta_score)}
                              />
                              <MetaLine
                                label="Channel fit"
                                value={String(
                                  message.qa_report.channel_fit_score,
                                )}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {message.qa_report.ready_for_review
                                ? "This variant looks ready for human review."
                                : message.qa_report.qa_status === "high_risk"
                                  ? "This variant needs close human review before approval."
                                  : "This variant likely needs cleanup before approval."}
                            </div>
                            {message.qa_report.analyzed_at ? (
                              <div className="text-xs text-muted-foreground">
                                Last analyzed{" "}
                                {new Date(
                                  message.qa_report.analyzed_at,
                                ).toLocaleString()}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              QA guidance
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div>
                              <div className="font-medium">
                                Warnings ({message.qa_report.warnings.length})
                              </div>
                              {message.qa_report.warnings.length ? (
                                <div className="mt-2 space-y-2">
                                  {message.qa_report.warnings.map((warning) => (
                                    <div
                                      key={warning}
                                      className="rounded-lg border p-3"
                                    >
                                      {warning}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-muted-foreground">
                                  No warnings detected for this variant.
                                </p>
                              )}
                            </div>
                            <div>
                              <div className="font-medium">
                                Suggestions (
                                {message.qa_report.suggestions.length})
                              </div>
                              {message.qa_report.suggestions.length ? (
                                <div className="mt-2 space-y-2">
                                  {message.qa_report.suggestions.map(
                                    (suggestion) => (
                                      <div
                                        key={suggestion}
                                        className="rounded-lg border border-dashed p-3"
                                      >
                                        {suggestion}
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : (
                                <p className="mt-2 text-muted-foreground">
                                  No extra suggestions for this variant.
                                </p>
                              )}
                            </div>
                            {message.qa_report.detected_issues.length ? (
                              <div className="text-xs text-muted-foreground">
                                Detected issues:{" "}
                                {message.qa_report.detected_issues.join(", ")}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Variant decision support
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            {decision ? (
                              <>
                                <div className="flex flex-wrap gap-2">
                                  <StateBadge
                                    value={decision.decision_status}
                                  />
                                  <Badge variant="outline">
                                    {labelDecisionEligibility(
                                      decision.decision_eligibility,
                                    )}
                                  </Badge>
                                  <Badge
                                    variant={
                                      decision.sufficient_data
                                        ? "secondary"
                                        : "outline"
                                    }
                                  >
                                    {decision.sufficient_data
                                      ? "sufficient data"
                                      : "insufficient data"}
                                  </Badge>
                                  <Badge variant="outline">
                                    {decision.decision_source}
                                  </Badge>
                                </div>
                                <div className="text-muted-foreground">
                                  {decision.decision_reason ||
                                    "No decision rationale recorded yet."}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {decision.sufficient_data_reason ||
                                    "No sufficient-data note yet."}
                                </div>
                              </>
                            ) : (
                              <p className="text-muted-foreground">
                                No decision support row recorded for this
                                variant yet.
                              </p>
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Variant metadata
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex flex-wrap gap-2">
                              <ProviderMetaBadges
                                providerName={
                                  message.provider_metadata.providerName
                                }
                                generationMode={
                                  message.provider_metadata.generationMode
                                }
                                model={message.provider_metadata.model}
                              />
                            </div>
                            {message.provider_metadata.note ? (
                              <p className="text-muted-foreground">
                                {message.provider_metadata.note}
                              </p>
                            ) : null}
                            {message.provider_metadata.fallbackReason ? (
                              <p className="text-amber-700">
                                Fallback:{" "}
                                {message.provider_metadata.fallbackReason}
                              </p>
                            ) : null}
                            {message.provider_metadata.requestId ? (
                              <p className="text-xs text-muted-foreground">
                                Request ID:{" "}
                                {message.provider_metadata.requestId}
                              </p>
                            ) : null}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Rationale
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                            <MetaLine
                              label="Angle"
                              value={
                                message.rationale_parts.angle || "Not specified"
                              }
                            />
                            <MetaLine
                              label="Audience intent"
                              value={
                                message.rationale_parts.audienceIntent ||
                                "Not specified"
                              }
                            />
                            <MetaLine
                              label="Why this channel"
                              value={
                                message.rationale_parts.whyChannel ||
                                "Not specified"
                              }
                            />
                            <MetaLine
                              label="Why this CTA"
                              value={
                                message.rationale_parts.whyCta ||
                                "Not specified"
                              }
                            />
                            {message.rationale_parts.note ? (
                              <div className="md:col-span-2">
                                <MetaLine
                                  label="Note"
                                  value={message.rationale_parts.note}
                                />
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>

                        {message.version_count > 1 ? (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">
                                Version comparison
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 lg:grid-cols-2">
                              <VersionSnapshot
                                label="Original"
                                version={message.original_version}
                              />
                              <VersionSnapshot
                                label="Current"
                                version={message.latest_version}
                              />
                            </CardContent>
                          </Card>
                        ) : null}

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Version history
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            {versions.length ? (
                              versions.map((version) => (
                                <div
                                  key={version.id}
                                  className="rounded-lg border border-dashed p-3"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                      v{version.version_number}
                                    </Badge>
                                    <Badge variant="secondary">
                                      {version.source_action}
                                    </Badge>
                                    <ProviderMetaBadges
                                      providerName={
                                        version.provider_metadata.providerName
                                      }
                                      generationMode={
                                        version.provider_metadata.generationMode
                                      }
                                      model={version.provider_metadata.model}
                                    />
                                    <span className="text-muted-foreground">
                                      {new Date(
                                        version.created_at,
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                  {version.provider_metadata.fallbackReason ? (
                                    <p className="mt-2 text-xs text-amber-700">
                                      Fallback:{" "}
                                      {version.provider_metadata.fallbackReason}
                                    </p>
                                  ) : null}
                                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                                    {version.rationale}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-muted-foreground">
                                No versions recorded yet.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <div className="space-y-4">
                        <form
                          action={`/api/admin/messages/${message.id}/edit`}
                          method="post"
                          className="space-y-2 rounded-lg border p-4"
                        >
                          <input
                            type="hidden"
                            name="redirectTo"
                            value={`/admin/campaigns/${detail.draft.id}`}
                          />
                          <div className="font-medium">Edit copy manually</div>
                          <Input
                            name="headline"
                            defaultValue={message.content.headline}
                            placeholder="Headline"
                          />
                          <Textarea
                            name="body"
                            rows={6}
                            defaultValue={message.content.body}
                            placeholder="Body"
                          />
                          <Input
                            name="cta"
                            defaultValue={message.content.cta}
                            placeholder="CTA"
                          />
                          <Input
                            name="rationaleNote"
                            placeholder="Why was this edited?"
                          />
                          <Button type="submit" variant="outline">
                            Save edit
                          </Button>
                        </form>

                        <form
                          action={`/api/admin/messages/${message.id}/regenerate`}
                          method="post"
                          className="space-y-2 rounded-lg border p-4"
                        >
                          <input
                            type="hidden"
                            name="redirectTo"
                            value={`/admin/campaigns/${detail.draft.id}`}
                          />
                          <div className="font-medium">Regenerate variant</div>
                          <Textarea
                            name="feedback_note"
                            rows={4}
                            placeholder="What should change in the next variant?"
                          />
                          <Button type="submit">Regenerate</Button>
                        </form>

                        <form
                          action={`/api/admin/messages/${message.id}/decision`}
                          method="post"
                          className="space-y-2 rounded-lg border p-4"
                        >
                          <input
                            type="hidden"
                            name="redirectTo"
                            value={`/admin/campaigns/${detail.draft.id}${from || to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ""}`}
                          />
                          <div className="font-medium">
                            Decision support override
                          </div>
                          <select
                            name="decisionStatus"
                            defaultValue={
                              decision?.decision_status || "candidate"
                            }
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                          >
                            {CAMPAIGN_VARIANT_DECISION_STATUSES.map(
                              (status) => (
                                <option key={status} value={status}>
                                  {labelDecisionStatus(status)}
                                </option>
                              ),
                            )}
                          </select>
                          <Textarea
                            name="reason"
                            rows={3}
                            placeholder="Why are you changing the decision state?"
                            defaultValue={decision?.decision_reason || ""}
                          />
                          <Button type="submit" variant="outline">
                            Save decision
                          </Button>
                        </form>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Internal notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action={`/api/admin/campaigns/${detail.draft.id}/notes`}
              method="post"
              className="space-y-3"
            >
              <input
                type="hidden"
                name="redirectTo"
                value={`/admin/campaigns/${detail.draft.id}`}
              />
              <Textarea
                name="note"
                rows={4}
                placeholder="Leave a collaboration note for the team."
              />
              <Button type="submit" variant="outline">
                Add internal note
              </Button>
            </form>

            <div className="space-y-3">
              {detail.internalNotes.length ? (
                detail.internalNotes.map((note) => (
                  <div key={note.id} className="rounded-lg border p-4">
                    <div className="text-sm whitespace-pre-wrap">
                      {note.note}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {detail.actorNames[note.created_by || ""] || "system"} |{" "}
                      {new Date(note.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No internal notes yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity feed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.activityFeed.length ? (
              detail.activityFeed.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    By {item.actor_label}
                    {item.message_id
                      ? ` | message ${item.message_id.slice(0, 8)}`
                      : ""}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No activity recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-medium">{label}</div>
      <p className="whitespace-pre-wrap text-muted-foreground">{value}</p>
    </div>
  );
}

function MessageCopyCard(args: {
  title: string;
  headline: string;
  body: string;
  cta: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{args.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <MetaLine label="Headline" value={args.headline} />
        <MetaLine label="Body" value={args.body} />
        <MetaLine label="CTA" value={args.cta} />
      </CardContent>
    </Card>
  );
}

function MetricTile(args: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {args.label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{args.value}</div>
      {args.hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{args.hint}</p>
      ) : null}
    </div>
  );
}

function ComparisonLine(args: {
  label: string;
  current: string;
  previous: string;
  delta: { delta: number | null; direction: "up" | "down" | "flat" };
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="font-medium">{args.label}</div>
      <div className="mt-1">{args.current}</div>
      <div className="text-xs text-muted-foreground">
        Previous {args.previous}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {formatDeltaText(args.delta)}
      </div>
    </div>
  );
}

function TrendSummaryCard(args: {
  series: {
    label: string;
    direction: "up" | "down" | "flat";
    summary: string;
    points: Array<{
      deliveries: number;
      opens: number;
      clicks: number;
      conversions: number;
    }>;
  };
}) {
  const latest = args.series.points.at(-1) || null;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-medium">{args.series.label}</div>
        <StateBadge value={args.series.direction} />
      </div>
      <p className="mt-1 text-muted-foreground">{args.series.summary}</p>
      {latest ? (
        <div className="mt-2 grid gap-2 md:grid-cols-4">
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
        <p className="mt-2 text-muted-foreground">No trend points yet.</p>
      )}
    </div>
  );
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatRate(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(1)}%`;
}

function formatDeltaText(delta: {
  delta: number | null;
  direction: "up" | "down" | "flat";
}) {
  if (delta.delta === null) return "No previous comparison yet.";
  const prefix = delta.direction === "up" ? "+" : "";
  return `${prefix}${delta.delta.toFixed(1)} vs previous period`;
}

function VersionSnapshot({
  label,
  version,
}: {
  label: string;
  version: {
    version_number: number;
    content: { headline: string; body: string; cta: string };
    provider_metadata?: {
      providerName: string;
      generationMode: string;
      model: string | null;
    };
  } | null;
}) {
  if (!version) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No snapshot available.
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="outline">{label}</Badge>
        <Badge variant="secondary">v{version.version_number}</Badge>
        {version.provider_metadata ? (
          <ProviderMetaBadges
            providerName={version.provider_metadata.providerName}
            generationMode={version.provider_metadata.generationMode}
            model={version.provider_metadata.model}
          />
        ) : null}
      </div>
      <MetaLine label="Headline" value={version.content.headline} />
      <MetaLine label="Body" value={version.content.body} />
      <MetaLine label="CTA" value={version.content.cta} />
    </div>
  );
}

function ProviderMetaBadges(args: {
  providerName: string;
  generationMode: string;
  model: string | null;
}) {
  return (
    <>
      <Badge variant="outline">
        {args.generationMode === "live"
          ? "Live"
          : args.generationMode === "fallback"
            ? "Fallback"
            : "Mock"}
      </Badge>
      <Badge variant="outline">{args.providerName}</Badge>
      {args.model ? <Badge variant="secondary">{args.model}</Badge> : null}
    </>
  );
}
