import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { cancelPublishJob } from "@/lib/campaigns/publish-queue";
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
    const job = await cancelPublishJob({
      admin,
      jobId: params.id,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_PUBLISH_QUEUE_JOB_CANCELLED",
      entity: "campaign_drafts",
      entityId: job.campaign_draft_id,
      meta: {
        note: "Publish job cancelled from admin.",
        publishJobId: job.id,
        channel: job.channel,
        publishMode: job.publish_mode,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${job.campaign_draft_id}`,
      payload: {
        ok: true,
        publishJob: job,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to cancel publish job";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
