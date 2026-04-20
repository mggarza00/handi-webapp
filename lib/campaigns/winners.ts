import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import type {
  MessagePerformanceSummary,
  PerformanceChannel,
  PerformanceSummary,
} from "@/lib/campaigns/analytics";
import { getCampaignAnalyticsDetail } from "@/lib/campaigns/analytics";
import { logAudit } from "@/lib/log-audit";
import type {
  CampaignDecisionEligibility,
  CampaignDecisionSource,
  CampaignDraftRow,
  CampaignMessageRow,
  CampaignPublishStatus,
  CampaignVariantDecisionRow,
  CampaignVariantDecisionStatus,
  CampaignWorkflowStatus,
} from "@/lib/campaigns/workflow";
import {
  labelChannel,
  labelGoal,
  normalizeDecisionEligibility,
  normalizeDecisionSource,
  normalizeDecisionStatus,
  normalizeMessageQaReport,
  normalizePublishStatus,
} from "@/lib/campaigns/workflow";

type AdminSupabase = SupabaseClient<Database>;

type DecisionRule = {
  autoSupported: boolean;
  minimumDeliveries: number;
  minimumOpens: number;
  minimumClicks: number;
  minimumConversions: number;
  marginRate: number;
  marginCount: number;
  reason: string;
};

export type CampaignDecisionSummary = {
  campaignId: string;
  sufficientData: boolean;
  sufficientDataCount: number;
  decisionEligibility: CampaignDecisionEligibility;
  hasWinner: boolean;
  winnerCount: number;
  manualOnly: boolean;
  channelSummaries: CampaignChannelDecisionSummary[];
};

export type CampaignChannelDecisionSummary = {
  channel: PerformanceChannel;
  decisionEligibility: CampaignDecisionEligibility;
  sufficientData: boolean;
  sufficientDataReason: string | null;
  winnerMessageId: string | null;
  winnerVariantName: string | null;
  decisionStatus: CampaignVariantDecisionStatus | null;
};

type StoredDecisionRow = CampaignVariantDecisionRow;

const DECISION_RULES: Record<PerformanceChannel, DecisionRule> = {
  email: {
    autoSupported: true,
    minimumDeliveries: 100,
    minimumOpens: 20,
    minimumClicks: 8,
    minimumConversions: 1,
    marginRate: 2,
    marginCount: 5,
    reason:
      "Email can auto-evaluate once delivery and open signals are stable enough.",
  },
  push: {
    autoSupported: true,
    minimumDeliveries: 150,
    minimumOpens: 0,
    minimumClicks: 8,
    minimumConversions: 1,
    marginRate: 1.5,
    marginCount: 4,
    reason:
      "Push can auto-evaluate once delivery and click signals are stable enough.",
  },
  whatsapp: {
    autoSupported: false,
    minimumDeliveries: 0,
    minimumOpens: 0,
    minimumClicks: 0,
    minimumConversions: 0,
    marginRate: 0,
    marginCount: 0,
    reason:
      "WhatsApp is still draft/export only in this phase, so decisioning stays manual.",
  },
  meta: {
    autoSupported: false,
    minimumDeliveries: 0,
    minimumOpens: 0,
    minimumClicks: 0,
    minimumConversions: 0,
    marginRate: 0,
    marginCount: 0,
    reason:
      "Meta remains export-only in this phase, so winner selection stays manual.",
  },
  landing: {
    autoSupported: false,
    minimumDeliveries: 0,
    minimumOpens: 0,
    minimumClicks: 0,
    minimumConversions: 0,
    marginRate: 0,
    marginCount: 0,
    reason:
      "Landing remains draft/export only in this phase, so decisioning stays manual.",
  },
  google: {
    autoSupported: false,
    minimumDeliveries: 0,
    minimumOpens: 0,
    minimumClicks: 0,
    minimumConversions: 0,
    marginRate: 0,
    marginCount: 0,
    reason:
      "Google remains export-only in this phase, so winner selection stays manual.",
  },
};

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function isPublishReadyForDecisions(status: CampaignPublishStatus) {
  return status === "published" || status === "paused";
}

function supportsAutomaticDecision(channel: PerformanceChannel) {
  return DECISION_RULES[channel].autoSupported;
}

function hasReliableSignal(summary: PerformanceSummary) {
  return summary.sources.some(
    (source) =>
      !/manual|snapshot|export/i.test(source) ||
      /publish_connector/i.test(source),
  );
}

function selectPrimaryRate(
  summary: PerformanceSummary,
  goal: CampaignDraftRow["goal"],
  channel: PerformanceChannel,
) {
  if (goal === "conversion" || goal === "acquisition" || goal === "upsell") {
    return summary.conversion_rate || summary.ctr || 0;
  }
  if (
    goal === "reactivation" ||
    goal === "activation" ||
    goal === "retention"
  ) {
    return channel === "email"
      ? summary.open_rate || summary.ctr || 0
      : summary.ctr || summary.open_rate || 0;
  }
  return channel === "email"
    ? summary.open_rate || summary.ctr || 0
    : summary.ctr || summary.open_rate || 0;
}

function compareMessages(
  left: MessagePerformanceSummary,
  right: MessagePerformanceSummary,
  goal: CampaignDraftRow["goal"],
) {
  const leftRate = selectPrimaryRate(left, goal, left.channel);
  const rightRate = selectPrimaryRate(right, goal, right.channel);

  return (
    right.conversions - left.conversions ||
    right.clicks - left.clicks ||
    right.opens - left.opens ||
    rightRate - leftRate ||
    right.qa_score - left.qa_score
  );
}

function isClearWinner(args: {
  leader: MessagePerformanceSummary;
  runnerUp: MessagePerformanceSummary | null;
  goal: CampaignDraftRow["goal"];
}) {
  if (!args.runnerUp) return false;

  const rule = DECISION_RULES[args.leader.channel];
  const leaderRate = selectPrimaryRate(
    args.leader,
    args.goal,
    args.leader.channel,
  );
  const runnerRate = selectPrimaryRate(
    args.runnerUp,
    args.goal,
    args.runnerUp.channel,
  );
  const rateGap = leaderRate - runnerRate;
  const clickGap = args.leader.clicks - args.runnerUp.clicks;
  const conversionGap = args.leader.conversions - args.runnerUp.conversions;

  return (
    conversionGap >= rule.minimumConversions ||
    rateGap >= rule.marginRate ||
    clickGap >= rule.marginCount
  );
}

function mapDecisionRow(value: Record<string, unknown>): StoredDecisionRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    campaign_message_id: readString(value.campaign_message_id),
    channel: readString(value.channel) as StoredDecisionRow["channel"],
    decision_status: normalizeDecisionStatus(value.decision_status),
    decision_source: normalizeDecisionSource(value.decision_source),
    decision_eligibility: normalizeDecisionEligibility(
      value.decision_eligibility,
    ),
    sufficient_data: readBoolean(value.sufficient_data),
    sufficient_data_reason: readNullableString(value.sufficient_data_reason),
    decision_reason: readNullableString(value.decision_reason),
    decided_by: readNullableString(value.decided_by),
    decided_at: readString(value.decided_at),
    metadata: readRecord(value.metadata),
    created_at: readString(value.created_at),
    updated_at: readString(value.updated_at),
  };
}

async function loadDecisionMessages(
  admin: AdminSupabase,
  campaignIds: string[],
): Promise<
  Array<
    Pick<
      CampaignMessageRow,
      "id" | "campaign_draft_id" | "channel" | "variant_name"
    >
  >
> {
  if (!campaignIds.length) return [];

  const { data, error } = await admin
    .from("campaign_messages")
    .select("id, campaign_draft_id, channel, variant_name")
    .in("campaign_draft_id", campaignIds);

  if (error) {
    throw new Error(error.message || "failed to load decision messages");
  }

  return (Array.isArray(data) ? data : []).map((row) => {
    const value = readRecord(row);
    return {
      id: readString(value.id),
      campaign_draft_id: readString(value.campaign_draft_id),
      channel: readString(value.channel) as CampaignMessageRow["channel"],
      variant_name: readString(value.variant_name),
    };
  });
}

export async function loadCampaignVariantDecisions(
  admin: AdminSupabase,
  campaignIds: string[],
): Promise<StoredDecisionRow[]> {
  if (!campaignIds.length) return [];

  const { data, error } = await admin
    .from("campaign_variant_decisions")
    .select("*")
    .in("campaign_draft_id", campaignIds)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(
      error.message || "failed to load campaign variant decisions",
    );
  }

  return (Array.isArray(data) ? data : []).map((row) =>
    mapDecisionRow(row as Record<string, unknown>),
  );
}

export function buildCampaignDecisionSummaries(args: {
  decisions: StoredDecisionRow[];
  messages: Array<
    Pick<
      CampaignMessageRow,
      "id" | "campaign_draft_id" | "channel" | "variant_name"
    >
  >;
}) {
  const messageById = new Map(
    args.messages.map((message) => [message.id, message]),
  );
  const decisionsByCampaign = new Map<string, StoredDecisionRow[]>();

  args.decisions.forEach((decision) => {
    const current = decisionsByCampaign.get(decision.campaign_draft_id) || [];
    current.push(decision);
    decisionsByCampaign.set(decision.campaign_draft_id, current);
  });

  const summaries = new Map<string, CampaignDecisionSummary>();

  decisionsByCampaign.forEach((decisionRows, campaignId) => {
    const channelRows = new Map<PerformanceChannel, StoredDecisionRow[]>();
    decisionRows.forEach((decision) => {
      const current =
        channelRows.get(decision.channel as PerformanceChannel) || [];
      current.push(decision);
      channelRows.set(decision.channel as PerformanceChannel, current);
    });

    const channelSummaries = Array.from(channelRows.entries()).map(
      ([channel, rows]) => {
        const winner =
          rows.find((row) => row.decision_status === "winner") || null;
        const candidate =
          rows.find((row) => row.decision_status === "candidate") || null;
        const reference = winner || candidate || rows[0] || null;
        const winnerMessage = winner
          ? messageById.get(winner.campaign_message_id) || null
          : null;

        return {
          channel,
          decisionEligibility: reference?.decision_eligibility || "limited",
          sufficientData: rows.some((row) => row.sufficient_data),
          sufficientDataReason: reference?.sufficient_data_reason || null,
          winnerMessageId: winner?.campaign_message_id || null,
          winnerVariantName: winnerMessage?.variant_name || null,
          decisionStatus: reference?.decision_status || null,
        };
      },
    );

    const eligibility = channelSummaries.some(
      (summary) => summary.decisionEligibility === "eligible",
    )
      ? "eligible"
      : channelSummaries.some(
            (summary) => summary.decisionEligibility === "limited",
          )
        ? "limited"
        : channelSummaries.some(
              (summary) => summary.decisionEligibility === "manual_only",
            )
          ? "manual_only"
          : "not_supported";

    summaries.set(campaignId, {
      campaignId,
      sufficientData: decisionRows.some((row) => row.sufficient_data),
      sufficientDataCount: decisionRows.filter((row) => row.sufficient_data)
        .length,
      decisionEligibility: eligibility,
      hasWinner: decisionRows.some((row) => row.decision_status === "winner"),
      winnerCount: decisionRows.filter(
        (row) => row.decision_status === "winner",
      ).length,
      manualOnly: decisionRows.every(
        (row) => row.decision_eligibility === "manual_only",
      ),
      channelSummaries,
    });
  });

  return summaries;
}

export async function getCampaignDecisionSummaries(
  admin: AdminSupabase,
  campaignIds: string[],
) {
  const [decisions, messages] = await Promise.all([
    loadCampaignVariantDecisions(admin, campaignIds),
    loadDecisionMessages(admin, campaignIds),
  ]);

  return buildCampaignDecisionSummaries({
    decisions,
    messages,
  });
}

function buildDecisionInput(args: {
  campaign: Pick<CampaignDraftRow, "id" | "goal" | "status" | "publish_status">;
  message: Pick<
    CampaignMessageRow,
    "id" | "campaign_draft_id" | "channel" | "variant_name" | "status"
  > & { qa_report?: unknown };
  summary: MessagePerformanceSummary;
}) {
  const rule = DECISION_RULES[args.message.channel as PerformanceChannel];

  if (
    args.campaign.status === "archived" ||
    args.message.status === "archived"
  ) {
    return {
      decision_status: "archived" as CampaignVariantDecisionStatus,
      decision_eligibility: "not_supported" as CampaignDecisionEligibility,
      sufficient_data: false,
      sufficient_data_reason: "This variant is archived.",
      decision_reason: "Archived variants are excluded from winner selection.",
      metadata: {
        threshold: null,
      },
    };
  }

  if (!supportsAutomaticDecision(args.message.channel as PerformanceChannel)) {
    return {
      decision_status: "manual_only" as CampaignVariantDecisionStatus,
      decision_eligibility: "manual_only" as CampaignDecisionEligibility,
      sufficient_data: false,
      sufficient_data_reason: rule.reason,
      decision_reason: rule.reason,
      metadata: {
        threshold: null,
      },
    };
  }

  if (
    args.campaign.status !== "approved" ||
    !isPublishReadyForDecisions(
      normalizePublishStatus(args.campaign.publish_status),
    )
  ) {
    return {
      decision_status: "insufficient_data" as CampaignVariantDecisionStatus,
      decision_eligibility: "limited" as CampaignDecisionEligibility,
      sufficient_data: false,
      sufficient_data_reason:
        "Decision support starts after approval and a live internal publish.",
      decision_reason:
        "This variant is still waiting for approved live data before auto-selection.",
      metadata: {
        threshold: {
          deliveries: rule.minimumDeliveries,
          opens: rule.minimumOpens,
          clicks: rule.minimumClicks,
        },
      },
    };
  }

  if (!hasReliableSignal(args.summary)) {
    return {
      decision_status: "insufficient_data" as CampaignVariantDecisionStatus,
      decision_eligibility: "limited" as CampaignDecisionEligibility,
      sufficient_data: false,
      sufficient_data_reason:
        "Only manual or export snapshots are available, so selection stays limited.",
      decision_reason:
        "Reliable live signal is missing, so this variant cannot be auto-ranked yet.",
      metadata: {
        threshold: {
          deliveries: rule.minimumDeliveries,
          opens: rule.minimumOpens,
          clicks: rule.minimumClicks,
        },
      },
    };
  }

  const enoughDeliveries = args.summary.deliveries >= rule.minimumDeliveries;
  const enoughOpens =
    rule.minimumOpens === 0 || args.summary.opens >= rule.minimumOpens;
  const enoughClicks = args.summary.clicks >= rule.minimumClicks;
  const enoughConversions =
    rule.minimumConversions === 0 ||
    args.summary.conversions >= rule.minimumConversions;
  const sufficientData =
    enoughDeliveries && (enoughOpens || enoughClicks || enoughConversions);

  return {
    decision_status: sufficientData
      ? ("candidate" as CampaignVariantDecisionStatus)
      : ("insufficient_data" as CampaignVariantDecisionStatus),
    decision_eligibility: sufficientData
      ? ("eligible" as CampaignDecisionEligibility)
      : ("limited" as CampaignDecisionEligibility),
    sufficient_data: sufficientData,
    sufficient_data_reason: sufficientData
      ? `Enough ${labelChannel(args.message.channel)} data is available to compare variants.`
      : `Need at least ${rule.minimumDeliveries} deliveries and stronger engagement before deciding on ${labelChannel(args.message.channel)}.`,
    decision_reason: sufficientData
      ? `This variant has enough signal for ${labelGoal(args.campaign.goal)} evaluation.`
      : "Signal is still too light for a confident decision.",
    metadata: {
      threshold: {
        deliveries: rule.minimumDeliveries,
        opens: rule.minimumOpens,
        clicks: rule.minimumClicks,
      },
    },
  };
}

function mapDecisionPayload(args: {
  campaignId: string;
  messageId: string;
  channel: PerformanceChannel;
  status: CampaignVariantDecisionStatus;
  source: CampaignDecisionSource;
  eligibility: CampaignDecisionEligibility;
  sufficientData: boolean;
  sufficientDataReason: string | null;
  decisionReason: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return {
    campaign_draft_id: args.campaignId,
    campaign_message_id: args.messageId,
    channel: args.channel,
    decision_status: args.status,
    decision_source: args.source,
    decision_eligibility: args.eligibility,
    sufficient_data: args.sufficientData,
    sufficient_data_reason: args.sufficientDataReason,
    decision_reason: args.decisionReason,
    decided_by: args.actorId || null,
    decided_at: new Date().toISOString(),
    metadata: args.metadata || {},
    updated_at: new Date().toISOString(),
  };
}

async function loadCampaignDecisionContext(
  admin: AdminSupabase,
  campaignId: string,
) {
  const [
    { data: campaignRow, error: campaignError },
    { data: messageRows, error: messageError },
  ] = await Promise.all([
    admin
      .from("campaign_drafts")
      .select("id, title, goal, status, publish_status")
      .eq("id", campaignId)
      .maybeSingle(),
    admin
      .from("campaign_messages")
      .select("id, campaign_draft_id, channel, variant_name, status, qa_report")
      .eq("campaign_draft_id", campaignId)
      .order("created_at", { ascending: true }),
  ]);

  if (campaignError || !campaignRow) {
    throw new Error(campaignError?.message || "campaign not found");
  }
  if (messageError) {
    throw new Error(messageError.message || "failed to load campaign messages");
  }

  const campaignValue = readRecord(campaignRow as unknown);
  const campaign = {
    id: readString(campaignValue.id),
    title: readString(campaignValue.title),
    goal: readString(campaignValue.goal) as CampaignDraftRow["goal"],
    status: readString(campaignValue.status) as CampaignWorkflowStatus,
    publish_status: normalizePublishStatus(campaignValue.publish_status),
  };
  const messages = (Array.isArray(messageRows) ? messageRows : []).map(
    (row) => {
      const value = readRecord(row);
      return {
        id: readString(value.id),
        campaign_draft_id: readString(value.campaign_draft_id),
        channel: readString(value.channel) as CampaignMessageRow["channel"],
        variant_name: readString(value.variant_name),
        status: readString(value.status) as CampaignWorkflowStatus,
        qa_report: normalizeMessageQaReport(value.qa_report),
      };
    },
  );

  return {
    campaign,
    messages,
  };
}

export async function recalculateCampaignVariantDecisions(
  admin: AdminSupabase,
  campaignId: string,
  actorId?: string | null,
) {
  const [{ campaign, messages }, analytics, existingRows] = await Promise.all([
    loadCampaignDecisionContext(admin, campaignId),
    getCampaignAnalyticsDetail(admin, campaignId),
    loadCampaignVariantDecisions(admin, [campaignId]),
  ]);

  const performanceByMessage = new Map(
    analytics.message_breakdown.map((item) => [item.message_id, item]),
  );
  const existingByMessage = new Map(
    existingRows.map((row) => [row.campaign_message_id, row]),
  );
  const nextPayloads: ReturnType<typeof mapDecisionPayload>[] = [];

  const messagesByChannel = new Map<PerformanceChannel, typeof messages>();
  messages.forEach((message) => {
    const current = messagesByChannel.get(message.channel) || [];
    current.push(message);
    messagesByChannel.set(message.channel, current);
  });

  messagesByChannel.forEach((channelMessages, channel) => {
    const channelSummaries = channelMessages
      .map((message) => ({
        message,
        summary:
          performanceByMessage.get(message.id) ||
          ({
            campaign_draft_id: campaignId,
            message_id: message.id,
            channel,
            variant_name: message.variant_name,
            status: message.status,
            qa_score: message.qa_report.overall_score,
            impressions: 0,
            clicks: 0,
            opens: 0,
            replies: 0,
            deliveries: 0,
            conversions: 0,
            failures: 0,
            spend: null,
            revenue: null,
            ctr: null,
            open_rate: null,
            click_to_open_rate: null,
            conversion_rate: null,
            delivery_rate: null,
            failure_rate: null,
            recorded_at: null,
            sources: [],
          } satisfies MessagePerformanceSummary),
      }))
      .map(({ message, summary }) => ({
        message,
        summary,
        baseDecision: buildDecisionInput({
          campaign,
          message,
          summary,
        }),
      }));

    const eligibleMessages = channelSummaries
      .filter((item) => item.baseDecision.decision_eligibility === "eligible")
      .sort((left, right) =>
        compareMessages(left.summary, right.summary, campaign.goal),
      );

    const leader = eligibleMessages[0] || null;
    const runnerUp = eligibleMessages[1]?.summary || null;
    const clearWinner =
      leader &&
      leader.message.qa_report.overall_score >= 60 &&
      isClearWinner({
        leader: leader.summary,
        runnerUp,
        goal: campaign.goal,
      });

    channelSummaries.forEach(({ message, summary, baseDecision }, index) => {
      let decisionStatus = baseDecision.decision_status;
      let decisionReason = baseDecision.decision_reason;

      if (baseDecision.decision_eligibility === "eligible") {
        if (clearWinner && leader?.message.id === message.id) {
          decisionStatus = "winner";
          decisionReason = `${message.variant_name} is leading ${labelChannel(channel)} for ${labelGoal(campaign.goal)} with enough signal and a clear performance gap.`;
        } else if (clearWinner) {
          decisionStatus = "loser";
          decisionReason = `${message.variant_name} is trailing the current winner in ${labelChannel(channel)} on both volume and primary rate.`;
        } else {
          decisionStatus = "candidate";
          decisionReason =
            index === 0
              ? `${message.variant_name} is the current candidate for ${labelChannel(channel)}, but the lead is not decisive enough yet.`
              : `${message.variant_name} remains a candidate until ${labelChannel(channel)} accumulates a clearer separation.`;
        }
      }

      nextPayloads.push(
        mapDecisionPayload({
          campaignId,
          messageId: message.id,
          channel,
          status: decisionStatus,
          source: "rule_based",
          eligibility: baseDecision.decision_eligibility,
          sufficientData: baseDecision.sufficient_data,
          sufficientDataReason: baseDecision.sufficient_data_reason,
          decisionReason,
          actorId,
          metadata: {
            summary,
            qaScore: message.qa_report.overall_score,
            rule: DECISION_RULES[channel],
          },
        }),
      );
    });
  });

  if (nextPayloads.length) {
    const { error } = await admin
      .from("campaign_variant_decisions")
      .upsert(nextPayloads as never, {
        onConflict: "campaign_message_id",
      });

    if (error) {
      throw new Error(error.message || "failed to persist variant decisions");
    }
  }

  const nextByMessage = new Map(
    nextPayloads.map((row) => [row.campaign_message_id, row]),
  );
  const sufficientDataChanges = nextPayloads.filter((row) => {
    const previous = existingByMessage.get(row.campaign_message_id);
    return previous?.sufficient_data !== row.sufficient_data;
  });
  const winnerChanges = nextPayloads.filter((row) => {
    const previous = existingByMessage.get(row.campaign_message_id);
    return previous?.decision_status !== row.decision_status;
  });

  await logAudit({
    actorId,
    action: "CAMPAIGN_ANALYTICS_COMPARED",
    entity: "campaign_drafts",
    entityId: campaignId,
    meta: {
      note: "Current vs previous analytics comparison recalculated for decision support.",
      campaignId,
    },
  });

  await logAudit({
    actorId,
    action: "CAMPAIGN_TRENDS_RECALCULATED",
    entity: "campaign_drafts",
    entityId: campaignId,
    meta: {
      note: "Trend summaries recalculated from the latest performance data.",
      campaignId,
    },
  });

  if (sufficientDataChanges.length) {
    await logAudit({
      actorId,
      action: "CAMPAIGN_SUFFICIENT_DATA_FLAGGED",
      entity: "campaign_drafts",
      entityId: campaignId,
      meta: {
        note: `${sufficientDataChanges.length} variant decision flag(s) updated for sufficient data.`,
        changes: sufficientDataChanges.map((row) => ({
          messageId: row.campaign_message_id,
          sufficientData: row.sufficient_data,
          reason: row.sufficient_data_reason,
        })),
      },
    });
  }

  const autoCandidates = winnerChanges.filter(
    (row) => row.decision_status === "candidate",
  );
  if (autoCandidates.length) {
    await logAudit({
      actorId,
      action: "CAMPAIGN_AUTOMATIC_CANDIDATE_DETECTED",
      entity: "campaign_drafts",
      entityId: campaignId,
      meta: {
        note: `${autoCandidates.length} variant candidate(s) detected from current data.`,
        candidates: autoCandidates.map((row) => row.campaign_message_id),
      },
    });
  }

  const winners = winnerChanges.filter(
    (row) => row.decision_status === "winner",
  );
  if (winners.length) {
    await logAudit({
      actorId,
      action: "CAMPAIGN_WINNER_SELECTED",
      entity: "campaign_drafts",
      entityId: campaignId,
      meta: {
        note: `${winners.length} winner decision(s) selected from reliable channel data.`,
        winners: winners.map((row) => ({
          messageId: row.campaign_message_id,
          channel: row.channel,
          reason: row.decision_reason,
        })),
      },
    });
  }

  const revertedWinners = existingRows.filter((row) => {
    const next = nextByMessage.get(row.campaign_message_id);
    return (
      row.decision_status === "winner" && next?.decision_status !== "winner"
    );
  });
  if (revertedWinners.length) {
    await logAudit({
      actorId,
      action: "CAMPAIGN_WINNER_REVERTED",
      entity: "campaign_drafts",
      entityId: campaignId,
      meta: {
        note: `${revertedWinners.length} winner decision(s) were reverted after recalculation.`,
        winners: revertedWinners.map((row) => ({
          messageId: row.campaign_message_id,
          channel: row.channel,
        })),
      },
    });
  }

  return loadCampaignVariantDecisions(admin, [campaignId]);
}

export async function recordManualVariantDecision(input: {
  admin: AdminSupabase;
  messageId: string;
  decisionStatus: CampaignVariantDecisionStatus;
  reason?: string | null;
  decidedBy?: string | null;
}) {
  const { admin } = input;
  const { data: messageRow, error: messageError } = await admin
    .from("campaign_messages")
    .select("id, campaign_draft_id, channel, variant_name, status")
    .eq("id", input.messageId)
    .maybeSingle();

  if (messageError || !messageRow) {
    throw new Error(messageError?.message || "campaign message not found");
  }

  const messageValue = readRecord(messageRow as unknown);
  const message = {
    id: readString(messageValue.id),
    campaign_draft_id: readString(messageValue.campaign_draft_id),
    channel: readString(messageValue.channel) as PerformanceChannel,
    variant_name: readString(messageValue.variant_name),
    status: readString(messageValue.status) as CampaignWorkflowStatus,
  };

  const currentDecisions = await recalculateCampaignVariantDecisions(
    admin,
    message.campaign_draft_id,
    null,
  );
  const current =
    currentDecisions.find(
      (row) => row.campaign_message_id === input.messageId,
    ) || null;

  if (input.decisionStatus === "winner") {
    const competingWinners = currentDecisions.filter(
      (row) =>
        row.campaign_message_id !== input.messageId &&
        row.campaign_draft_id === message.campaign_draft_id &&
        row.channel === message.channel &&
        row.decision_status === "winner",
    );

    if (competingWinners.length) {
      const demotions = competingWinners.map((row) =>
        mapDecisionPayload({
          campaignId: row.campaign_draft_id,
          messageId: row.campaign_message_id,
          channel: row.channel as PerformanceChannel,
          status: "loser",
          source: "manual",
          eligibility: row.decision_eligibility,
          sufficientData: row.sufficient_data,
          sufficientDataReason: row.sufficient_data_reason,
          decisionReason:
            "Another variant was manually selected as the winner.",
          actorId: input.decidedBy,
          metadata: row.metadata,
        }),
      );
      const { error } = await admin
        .from("campaign_variant_decisions")
        .upsert(demotions as never, { onConflict: "campaign_message_id" });
      if (error) {
        throw new Error(error.message || "failed to demote previous winner");
      }
    }
  }

  const payload = mapDecisionPayload({
    campaignId: message.campaign_draft_id,
    messageId: input.messageId,
    channel: message.channel,
    status: input.decisionStatus,
    source: "manual",
    eligibility: current?.decision_eligibility || "limited",
    sufficientData: current?.sufficient_data || false,
    sufficientDataReason: current?.sufficient_data_reason || null,
    decisionReason:
      input.reason?.trim() ||
      `Manual decision recorded for ${message.variant_name} in ${labelChannel(message.channel)}.`,
    actorId: input.decidedBy,
    metadata: {
      previousStatus: current?.decision_status || null,
      previousSource: current?.decision_source || null,
    },
  });

  const { data, error } = await admin
    .from("campaign_variant_decisions")
    .upsert(payload as never, { onConflict: "campaign_message_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "failed to store manual variant decision",
    );
  }

  const next = mapDecisionRow(data as Record<string, unknown>);
  await logAudit({
    actorId: input.decidedBy,
    action: "CAMPAIGN_MANUAL_DECISION_RECORDED",
    entity: "campaign_drafts",
    entityId: message.campaign_draft_id,
    meta: {
      note:
        input.reason?.trim() ||
        `${message.variant_name} marked as ${input.decisionStatus}.`,
      messageId: message.id,
      channel: message.channel,
      decisionStatus: input.decisionStatus,
      decisionSource: "manual",
    },
  });

  if (
    current?.decision_status === "winner" &&
    input.decisionStatus !== "winner"
  ) {
    await logAudit({
      actorId: input.decidedBy,
      action: "CAMPAIGN_WINNER_REVERTED",
      entity: "campaign_drafts",
      entityId: message.campaign_draft_id,
      meta: {
        note: `${message.variant_name} is no longer the winner for ${labelChannel(message.channel)}.`,
        messageId: message.id,
        channel: message.channel,
      },
    });
  } else if (input.decisionStatus === "winner") {
    await logAudit({
      actorId: input.decidedBy,
      action: "CAMPAIGN_WINNER_SELECTED",
      entity: "campaign_drafts",
      entityId: message.campaign_draft_id,
      meta: {
        note: `${message.variant_name} was marked as the winner for ${labelChannel(message.channel)}.`,
        messageId: message.id,
        channel: message.channel,
      },
    });
  }

  return next;
}
