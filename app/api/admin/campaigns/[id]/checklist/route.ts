import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { updateCampaignReviewChecklist } from "@/lib/campaigns/repository";
import {
  REVIEW_CHECKLIST_FIELDS,
  normalizeReviewChecklist,
} from "@/lib/campaigns/workflow";
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
    const checklist = normalizeReviewChecklist(
      Object.fromEntries(
        REVIEW_CHECKLIST_FIELDS.map((field) => [
          field,
          payload[field] === "on",
        ]),
      ),
    );

    const admin = getAdminSupabase();
    const draft = await updateCampaignReviewChecklist({
      admin,
      campaignId: params.id,
      checklist,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_CHECKLIST_UPDATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: `${Object.values(checklist).filter(Boolean).length}/${REVIEW_CHECKLIST_FIELDS.length} checks completed.`,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${params.id}`,
      payload: { ok: true, checklist: draft.campaign_review_checklist },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to update checklist";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
