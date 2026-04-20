import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import {
  CAMPAIGN_VARIANT_DECISION_STATUSES,
  type CampaignVariantDecisionStatus,
} from "@/lib/campaigns/workflow";
import { recordManualVariantDecision } from "@/lib/campaigns/winners";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const payload = await readRequestPayload(req);
    const redirectTo =
      typeof payload.redirectTo === "string" ? payload.redirectTo : null;
    const decisionStatus =
      typeof payload.decisionStatus === "string"
        ? payload.decisionStatus
        : typeof payload.decision_status === "string"
          ? payload.decision_status
          : "";
    const reason =
      typeof payload.reason === "string"
        ? payload.reason
        : typeof payload.note === "string"
          ? payload.note
          : typeof payload.feedbackNote === "string"
            ? payload.feedbackNote
            : "";

    if (
      !CAMPAIGN_VARIANT_DECISION_STATUSES.includes(
        decisionStatus as CampaignVariantDecisionStatus,
      )
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_decision_status" },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const decision = await recordManualVariantDecision({
      admin,
      messageId: params.id,
      decisionStatus: decisionStatus as CampaignVariantDecisionStatus,
      reason,
      decidedBy: gate.userId,
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo:
        redirectTo || `/admin/campaigns/${decision.campaign_draft_id}`,
      payload: {
        ok: true,
        decision,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to store decision";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
