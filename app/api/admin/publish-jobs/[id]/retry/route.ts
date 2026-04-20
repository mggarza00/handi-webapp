import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { retryPublishJob } from "@/lib/campaigns/publish";
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
    const result = await retryPublishJob({
      admin,
      jobId: params.id,
      triggeredBy: gate.userId,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_PUBLISH_RETRY_REQUESTED",
      entity: "campaign_drafts",
      entityId: result.draftId,
      meta: {
        note: "Retry requested for publish job.",
        publishJobId: params.id,
        channel: result.channel,
        publishMode: result.mode,
        messageId: result.messageId,
      },
    });

    await logAudit({
      actorId: gate.userId,
      action: result.ok
        ? "CAMPAIGN_PUBLISH_SUCCEEDED"
        : "CAMPAIGN_PUBLISH_FAILED",
      entity: "campaign_drafts",
      entityId: result.draftId,
      meta: {
        note: result.ok
          ? result.job.provider_response_summary
          : result.errorMessage || result.job.provider_response_summary,
        channel: result.channel,
        publishMode: result.mode,
        publishJobId: result.job.id,
        messageId: result.messageId,
        error: result.errorMessage,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${result.draftId}`,
      payload: {
        ok: result.ok,
        draftId: result.draftId,
        publishJob: result.job,
        errorMessage: result.errorMessage,
      },
      status: result.ok ? 200 : 500,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to retry publish job";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
