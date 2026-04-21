import type {
  CampaignAnalyticsDashboard,
  CampaignAnalyticsDetail,
  ChannelPerformanceSummary,
  MessagePerformanceSummary,
  PerformanceSummary,
} from "@/lib/campaigns/analytics";
import type { CampaignDraftRow } from "@/lib/campaigns/workflow";
import { labelChannel, labelGoal } from "@/lib/campaigns/workflow";

export type CampaignRecommendation = {
  id: string;
  kind: "positive" | "warning" | "opportunity";
  scope: "campaign" | "channel" | "message" | "portfolio";
  title: string;
  detail: string;
};

function hasEnoughVolume(summary: PerformanceSummary) {
  return (
    summary.deliveries >= 10 ||
    summary.impressions >= 100 ||
    summary.clicks >= 5 ||
    summary.opens >= 5
  );
}

function sortedByEngagement(messages: MessagePerformanceSummary[]) {
  return [...messages].sort(
    (left, right) =>
      right.conversions - left.conversions ||
      right.clicks - left.clicks ||
      (right.ctr || 0) - (left.ctr || 0),
  );
}

function pickBestChannel(channels: ChannelPerformanceSummary[]) {
  return [...channels].sort(
    (left, right) =>
      right.conversions - left.conversions ||
      right.clicks - left.clicks ||
      (right.ctr || 0) - (left.ctr || 0),
  )[0];
}

export function buildCampaignRecommendations(args: {
  draft: Pick<CampaignDraftRow, "id" | "title" | "goal" | "cta" | "qa_report">;
  analytics: CampaignAnalyticsDetail;
}): CampaignRecommendation[] {
  const recommendations: CampaignRecommendation[] = [];
  const bestChannel = pickBestChannel(args.analytics.channel_breakdown);
  const rankedMessages = sortedByEngagement(args.analytics.message_breakdown);
  const winner = rankedMessages[0];
  const runnerUp = rankedMessages[1];

  if (bestChannel && hasEnoughVolume(bestChannel)) {
    recommendations.push({
      id: `channel-${bestChannel.channel}`,
      kind: "positive",
      scope: "channel",
      title: `${labelChannel(bestChannel.channel)} is leading`,
      detail:
        bestChannel.conversions > 0
          ? `${labelChannel(bestChannel.channel)} is carrying the strongest result for ${args.draft.title} with ${bestChannel.conversions} conversion${bestChannel.conversions === 1 ? "" : "s"} and ${(bestChannel.conversion_rate || 0).toFixed(1)}% conversion rate.`
          : `${labelChannel(bestChannel.channel)} is currently leading attention with ${(bestChannel.ctr || bestChannel.open_rate || 0).toFixed(1)}% response rate. Keep this channel in the next iteration.`,
    });
  }

  if (
    winner &&
    runnerUp &&
    hasEnoughVolume(winner) &&
    (winner.ctr || 0) >= (runnerUp.ctr || 0) + 3
  ) {
    recommendations.push({
      id: `winner-${winner.message_id}`,
      kind: "positive",
      scope: "message",
      title: `${winner.variant_name} is outperforming`,
      detail: `${winner.variant_name} is beating the next variant in ${labelChannel(winner.channel)}. Consider keeping its angle and testing only the CTA or offer in the next pass.`,
    });
  }

  if (
    args.draft.qa_report.overall_score >= 85 &&
    args.analytics.summary.clicks > 0 &&
    args.analytics.summary.conversions === 0
  ) {
    recommendations.push({
      id: "high-qa-low-conversion",
      kind: "warning",
      scope: "campaign",
      title: "High QA, low conversion",
      detail: `The campaign reads well but clicks are not converting. Revisit the offer and CTA "${args.draft.cta}" before duplicating the brief.`,
    });
  }

  if (
    args.analytics.summary.deliveries > 0 &&
    args.analytics.summary.clicks === 0 &&
    args.analytics.summary.opens <= 1
  ) {
    recommendations.push({
      id: "low-action-signal",
      kind: "warning",
      scope: "campaign",
      title: "Low action signal",
      detail:
        "The campaign is reaching people but not moving them. Tighten the first line and make the next step more concrete.",
    });
  }

  if ((args.analytics.summary.failure_rate || 0) >= 15) {
    recommendations.push({
      id: "delivery-risk",
      kind: "warning",
      scope: "campaign",
      title: "Delivery risk detected",
      detail:
        "Failure rate is elevated. Check targeting inputs, recipient quality, or connector configuration before the next publish.",
    });
  }

  if (
    bestChannel &&
    winner &&
    hasEnoughVolume(bestChannel) &&
    (bestChannel.ctr || 0) >= 3
  ) {
    recommendations.push({
      id: "duplicate-with-cta-test",
      kind: "opportunity",
      scope: "campaign",
      title: "Good candidate for a duplicate test",
      detail: `Duplicate this campaign and keep the ${labelChannel(bestChannel.channel)} angle, but test a sharper CTA against "${args.draft.cta}" for the ${labelGoal(args.draft.goal)} goal.`,
    });
  }

  return recommendations.slice(0, 5);
}

export function buildDashboardRecommendations(
  dashboard: CampaignAnalyticsDashboard,
): CampaignRecommendation[] {
  const recommendations: CampaignRecommendation[] = [];
  const bestChannel = pickBestChannel(dashboard.channel_breakdown);
  const topCampaign = [...dashboard.campaign_rows].sort(
    (left, right) =>
      right.summary.conversions - left.summary.conversions ||
      right.summary.clicks - left.summary.clicks ||
      (right.summary.ctr || 0) - (left.summary.ctr || 0),
  )[0];

  if (bestChannel && hasEnoughVolume(bestChannel)) {
    recommendations.push({
      id: `portfolio-best-${bestChannel.channel}`,
      kind: "positive",
      scope: "portfolio",
      title: `${labelChannel(bestChannel.channel)} is the strongest channel right now`,
      detail:
        bestChannel.conversions > 0
          ? `${labelChannel(bestChannel.channel)} is driving the best downstream result across published campaigns. Use it as the control channel in the next round.`
          : `${labelChannel(bestChannel.channel)} is producing the best early engagement. Keep using it to validate new angles before scaling.`,
    });
  }

  if (topCampaign && topCampaign.summary.conversions > 0) {
    recommendations.push({
      id: `top-campaign-${topCampaign.id}`,
      kind: "positive",
      scope: "portfolio",
      title: `${topCampaign.title} is the current top performer`,
      detail: `${topCampaign.title} is leading with ${topCampaign.summary.conversions} conversion${topCampaign.summary.conversions === 1 ? "" : "s"}. Review its angle and CTA before creating the next brief.`,
    });
  }

  const highQaLowPerf = dashboard.campaign_rows.find(
    (row) =>
      row.qa_score >= 85 &&
      row.summary.clicks > 0 &&
      row.summary.conversions === 0,
  );
  if (highQaLowPerf) {
    recommendations.push({
      id: `high-qa-low-perf-${highQaLowPerf.id}`,
      kind: "warning",
      scope: "portfolio",
      title: "Strong editorial score, weak business signal",
      detail: `${highQaLowPerf.title} has strong QA but weak performance. Review its offer and CTA before producing more variants in the same angle.`,
    });
  }

  const failedCampaign = dashboard.campaign_rows.find(
    (row) => (row.summary.failure_rate || 0) >= 15,
  );
  if (failedCampaign) {
    recommendations.push({
      id: `failure-risk-${failedCampaign.id}`,
      kind: "warning",
      scope: "portfolio",
      title: "One campaign has elevated delivery risk",
      detail: `${failedCampaign.title} is showing a high failure rate. Validate targeting lists and connector setup before the next send.`,
    });
  }

  if (topCampaign && bestChannel && (bestChannel.ctr || 0) >= 3) {
    recommendations.push({
      id: "next-brief-opportunity",
      kind: "opportunity",
      scope: "portfolio",
      title: "Next experiment is clear",
      detail: `Duplicate the best-performing approved campaign and test a new CTA while keeping ${labelChannel(bestChannel.channel)} as the main learning channel.`,
    });
  }

  return recommendations.slice(0, 5);
}
