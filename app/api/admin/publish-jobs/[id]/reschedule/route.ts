import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { reschedulePublishJob } from "@/lib/campaigns/publish-queue";
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
    const job = await reschedulePublishJob({
      admin,
      jobId: params.id,
      scheduledFor:
        typeof payload.scheduledFor === "string" ? payload.scheduledFor : null,
      executionWindowStart:
        typeof payload.executionWindowStart === "string"
          ? payload.executionWindowStart
          : null,
      executionWindowEnd:
        typeof payload.executionWindowEnd === "string"
          ? payload.executionWindowEnd
          : null,
      maxRetries:
        typeof payload.maxRetries === "string" && payload.maxRetries
          ? Number(payload.maxRetries)
          : undefined,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_PUBLISH_SCHEDULED",
      entity: "campaign_drafts",
      entityId: job.campaign_draft_id,
      meta: {
        note: job.scheduled_for
          ? `Publish job rescheduled for ${job.scheduled_for}.`
          : "Publish job returned to the internal queue.",
        publishJobId: job.id,
        channel: job.channel,
        publishMode: job.publish_mode,
        queueStatus: job.queue_status,
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
      error instanceof Error
        ? error.message
        : "failed to reschedule publish job";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
