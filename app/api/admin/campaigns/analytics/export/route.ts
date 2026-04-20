import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  getCampaignAnalyticsDashboard,
  getCampaignAnalyticsDetail,
  type CampaignAnalyticsCampaignRow,
  type MessagePerformanceSummary,
  type PublishJobPerformanceSummary,
} from "@/lib/campaigns/analytics";
import {
  coerceAudienceFilter,
  coerceCampaignStatus,
  coerceGoalFilter,
} from "@/lib/campaigns/workflow";
import {
  getCampaignDecisionSummaries,
  type CampaignDecisionSummary,
} from "@/lib/campaigns/winners";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportScope = "campaigns" | "messages" | "publish_jobs";

function esc(value: unknown) {
  const text = (value ?? "").toString();
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = rows.map((row) =>
    headers.map((header) => esc(row[header])).join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

function summaryToRow(summary: {
  impressions: number;
  clicks: number;
  opens: number;
  replies: number;
  deliveries: number;
  conversions: number;
  failures: number;
  spend: number | null;
  revenue: number | null;
  ctr: number | null;
  open_rate: number | null;
  click_to_open_rate: number | null;
  conversion_rate: number | null;
  delivery_rate: number | null;
  failure_rate: number | null;
  recorded_at: string | null;
  sources: string[];
}) {
  return {
    impressions: summary.impressions,
    clicks: summary.clicks,
    opens: summary.opens,
    replies: summary.replies,
    deliveries: summary.deliveries,
    conversions: summary.conversions,
    failures: summary.failures,
    spend: summary.spend,
    revenue: summary.revenue,
    ctr: summary.ctr,
    open_rate: summary.open_rate,
    click_to_open_rate: summary.click_to_open_rate,
    conversion_rate: summary.conversion_rate,
    delivery_rate: summary.delivery_rate,
    failure_rate: summary.failure_rate,
    recorded_at: summary.recorded_at,
    sources: summary.sources.join(" | "),
  };
}

function campaignRowsToExport(rows: CampaignAnalyticsCampaignRow[]) {
  return rows.map((row) => ({
    campaign_id: row.id,
    title: row.title,
    audience: row.audience,
    goal: row.goal,
    status: row.status,
    publish_status: row.publish_status,
    qa_score: row.qa_score,
    channel_count: row.channel_count,
    publish_job_count: row.publish_job_count,
    updated_at: row.updated_at,
    ...summaryToRow(row.summary),
  }));
}

function messageRowsToExport(rows: MessagePerformanceSummary[]) {
  return rows.map((row) => ({
    campaign_id: row.campaign_draft_id,
    message_id: row.message_id,
    channel: row.channel,
    variant_name: row.variant_name,
    status: row.status,
    qa_score: row.qa_score,
    ...summaryToRow(row),
  }));
}

function publishJobRowsToExport(rows: PublishJobPerformanceSummary[]) {
  return rows.map((row) => ({
    publish_job_id: row.job_id,
    campaign_id: row.campaign_draft_id,
    campaign_title: row.campaign_title,
    channel: row.channel,
    publish_status: row.publish_status,
    publish_mode: row.publish_mode,
    provider_name: row.provider_name,
    message_id: row.message_id,
    message_variant_name: row.message_variant_name,
    triggered_at: row.triggered_at,
    completed_at: row.completed_at,
    ...summaryToRow(row),
  }));
}

function normalizeBinaryFilter(value: string | null) {
  return value === "yes" || value === "no" ? value : "";
}

function normalizeEligibilityFilter(value: string | null) {
  return value === "eligible" ||
    value === "limited" ||
    value === "manual_only" ||
    value === "not_supported"
    ? value
    : "";
}

function matchesDecisionFilters(
  summary: CampaignDecisionSummary | undefined,
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

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "json").toLowerCase();
    const scope = ((
      url.searchParams.get("scope") || "campaigns"
    ).toLowerCase() || "campaigns") as ExportScope;
    const campaignId = url.searchParams.get("campaignId");
    const sufficientData = normalizeBinaryFilter(
      url.searchParams.get("sufficientData"),
    );
    const winner = normalizeBinaryFilter(url.searchParams.get("winner"));
    const eligibility = normalizeEligibilityFilter(
      url.searchParams.get("eligibility"),
    );
    const admin = getAdminSupabase();

    let rows: Array<Record<string, unknown>> = [];

    if (campaignId) {
      const detail = await getCampaignAnalyticsDetail(admin, campaignId, {
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
      });
      rows =
        scope === "messages"
          ? messageRowsToExport(detail.message_breakdown)
          : scope === "publish_jobs"
            ? publishJobRowsToExport(detail.publish_job_breakdown)
            : [
                {
                  campaign_id: campaignId,
                  ...summaryToRow(detail.summary),
                },
              ];
    } else {
      const baseDashboard = await getCampaignAnalyticsDashboard(admin, {
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        channel: (url.searchParams.get("channel") || "") as
          | ""
          | "meta"
          | "email"
          | "whatsapp"
          | "push"
          | "landing"
          | "google",
        status: coerceCampaignStatus(url.searchParams.get("status")),
        audience: coerceAudienceFilter(url.searchParams.get("audience")),
        goal: coerceGoalFilter(url.searchParams.get("goal")),
      });
      const baseIds = baseDashboard.campaign_rows.map((row) => row.id);
      const decisionSummaries = await getCampaignDecisionSummaries(
        admin,
        baseIds,
      );
      const filteredIds =
        sufficientData || winner || eligibility
          ? baseIds.filter((id) =>
              matchesDecisionFilters(decisionSummaries.get(id), {
                sufficientData,
                winner,
                eligibility,
              }),
            )
          : baseIds;
      const dashboard =
        sufficientData || winner || eligibility
          ? await getCampaignAnalyticsDashboard(admin, {
              from: url.searchParams.get("from"),
              to: url.searchParams.get("to"),
              channel: (url.searchParams.get("channel") || "") as
                | ""
                | "meta"
                | "email"
                | "whatsapp"
                | "push"
                | "landing"
                | "google",
              status: coerceCampaignStatus(url.searchParams.get("status")),
              audience: coerceAudienceFilter(url.searchParams.get("audience")),
              goal: coerceGoalFilter(url.searchParams.get("goal")),
              campaignIds: filteredIds,
            })
          : baseDashboard;

      rows =
        scope === "publish_jobs"
          ? publishJobRowsToExport(dashboard.recent_publish_jobs)
          : scope === "messages"
            ? messageRowsToExport(dashboard.top_messages)
            : campaignRowsToExport(dashboard.campaign_rows);
    }

    if (format === "csv") {
      if (campaignId) {
        await logAudit({
          actorId: gate.userId,
          action: "CAMPAIGN_ANALYTICS_EXPORTED",
          entity: "campaign_drafts",
          entityId: campaignId,
          meta: {
            note: `Exported ${scope} analytics as CSV.`,
            scope,
            format: "csv",
            rows: rows.length,
          },
        });
      }
      const csv = toCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=campaign_${scope}.csv`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (campaignId) {
      await logAudit({
        actorId: gate.userId,
        action: "CAMPAIGN_ANALYTICS_EXPORTED",
        entity: "campaign_drafts",
        entityId: campaignId,
        meta: {
          note: `Exported ${scope} analytics as JSON.`,
          scope,
          format: "json",
          rows: rows.length,
        },
      });
    }

    return NextResponse.json(
      { ok: true, scope, format: "json", rows },
      { headers: JSONH },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to export analytics";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
