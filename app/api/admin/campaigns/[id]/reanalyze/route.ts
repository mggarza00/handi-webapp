import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { reanalyzeCampaignQa } from "@/lib/campaigns/repository";
import { logAudit } from "@/lib/log-audit";
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

    const admin = getAdminSupabase();
    const result = await reanalyzeCampaignQa(admin, params.id);

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_QA_REANALYZED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: `QA ${result.draft.qa_report.qa_status} with score ${result.draft.qa_report.overall_score}.`,
        qaStatus: result.draft.qa_report.qa_status,
        reviewerPriority: result.draft.qa_report.reviewer_priority,
        overallScore: result.draft.qa_report.overall_score,
        warningsCount: result.draft.qa_report.warnings.length,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${params.id}`,
      payload: {
        ok: true,
        campaignId: params.id,
        qa: result.draft.qa_report,
        messages: result.messages.map((message) => ({
          id: message.id,
          qa: message.qa_report,
        })),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to reanalyze campaign";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
