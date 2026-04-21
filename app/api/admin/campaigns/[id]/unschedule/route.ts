import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { unscheduleCampaignPublishes } from "@/lib/campaigns/publish-queue";
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
    const jobs = await unscheduleCampaignPublishes({
      admin,
      campaignId: params.id,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_PUBLISH_UNSCHEDULED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: `${jobs.length} queued publish job(s) removed.`,
        publishJobIds: jobs.map((job) => job.id),
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${params.id}`,
      payload: {
        ok: true,
        campaignId: params.id,
        removedJobIds: jobs.map((job) => job.id),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to unschedule publish jobs";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
