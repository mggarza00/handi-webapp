import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { markCampaignReadyToPublish } from "@/lib/campaigns/publish";
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
    const draft = await markCampaignReadyToPublish(admin, {
      campaignId: params.id,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_MARKED_READY_TO_PUBLISH",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: "Campaign marked ready to publish.",
        publishStatus: draft.publish_status,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${params.id}`,
      payload: {
        ok: true,
        campaignId: params.id,
        publishStatus: draft.publish_status,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to mark campaign ready to publish";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
