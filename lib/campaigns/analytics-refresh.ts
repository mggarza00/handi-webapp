import type { SupabaseClient } from "@supabase/supabase-js";

import { getCampaignAnalyticsDetail } from "@/lib/campaigns/analytics";
import { getCampaignDetail } from "@/lib/campaigns/repository";
import { buildCampaignRecommendations } from "@/lib/campaigns/recommendations";
import { recalculateCampaignVariantDecisions } from "@/lib/campaigns/winners";
import { logAudit } from "@/lib/log-audit";
import type { Database } from "@/types/supabase";

type AdminSupabase = SupabaseClient<Database>;

export async function refreshCampaignLearningLoop(input: {
  admin: AdminSupabase;
  campaignId: string;
  actorId?: string | null;
  metricsIngested?: number;
  eventsIngested?: number;
  metricSources?: string[];
  eventSources?: string[];
  note?: string | null;
}) {
  const [detail, analytics] = await Promise.all([
    getCampaignDetail(input.admin, input.campaignId),
    getCampaignAnalyticsDetail(input.admin, input.campaignId),
  ]);
  const recommendations = detail
    ? buildCampaignRecommendations({
        draft: detail.draft,
        analytics,
      })
    : [];
  const decisions = await recalculateCampaignVariantDecisions(
    input.admin,
    input.campaignId,
    input.actorId || null,
  );

  await logAudit({
    actorId: input.actorId || null,
    action: "CAMPAIGN_METRICS_INGESTED",
    entity: "campaign_drafts",
    entityId: input.campaignId,
    meta: {
      note:
        input.note ||
        `Ingested ${input.metricsIngested || 0} metric snapshot(s) and ${input.eventsIngested || 0} event(s).`,
      metricsIngested: input.metricsIngested || 0,
      eventsIngested: input.eventsIngested || 0,
      metricSources: input.metricSources || [],
      eventSources: input.eventSources || [],
    },
  });

  await logAudit({
    actorId: input.actorId || null,
    action: "CAMPAIGN_PERFORMANCE_UPDATED",
    entity: "campaign_drafts",
    entityId: input.campaignId,
    meta: {
      note: `Performance updated. CTR ${analytics.summary.ctr ?? 0}%, open rate ${analytics.summary.open_rate ?? 0}%, conversion rate ${analytics.summary.conversion_rate ?? 0}%.`,
      summary: analytics.summary,
      signalSummary: analytics.signal_summary,
    },
  });

  await logAudit({
    actorId: input.actorId || null,
    action: "CAMPAIGN_RECOMMENDATIONS_RECALCULATED",
    entity: "campaign_drafts",
    entityId: input.campaignId,
    meta: {
      note: `${recommendations.length} recommendation(s) recalculated from current performance.`,
      recommendationCount: recommendations.length,
      recommendations,
    },
  });

  return {
    campaignId: input.campaignId,
    title: detail?.draft.title || "Campaign",
    summary: analytics.summary,
    signalSummary: analytics.signal_summary,
    recommendations,
    decisions,
  };
}
