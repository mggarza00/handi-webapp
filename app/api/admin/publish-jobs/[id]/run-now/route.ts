import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { runPublishJobNow } from "@/lib/campaigns/publish-queue";
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
    const result = await runPublishJobNow({
      admin,
      jobId: params.id,
      triggeredBy: gate.userId,
    });

    const job = result.job;
    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${job.campaign_draft_id}`,
      payload: {
        ok: result.status === "completed",
        status: result.status,
        publishJob: job,
      },
      status: result.status === "failed" ? 500 : 200,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to run publish job";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
