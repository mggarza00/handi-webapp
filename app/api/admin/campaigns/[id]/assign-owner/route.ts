import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  assignCampaignOwner,
  listReviewerOptions,
} from "@/lib/campaigns/repository";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
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
    const ownerUserId =
      typeof payload.ownerUserId === "string"
        ? payload.ownerUserId.trim()
        : typeof payload.owner_user_id === "string"
          ? payload.owner_user_id.trim()
          : "";

    const admin = getAdminSupabase();
    const draft = await assignCampaignOwner({
      admin,
      campaignId: params.id,
      ownerUserId: ownerUserId || null,
    });
    const reviewerOptions = await listReviewerOptions(admin);
    const ownerLabel =
      reviewerOptions.find((item) => item.id === draft.owner_user_id)?.label ||
      null;

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_OWNER_ASSIGNED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        ownerUserId: draft.owner_user_id,
        ownerLabel,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${params.id}`,
      payload: {
        ok: true,
        campaignId: params.id,
        ownerUserId: draft.owner_user_id,
        ownerAssignedAt: draft.owner_assigned_at,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to assign owner";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
