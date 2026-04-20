import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { runDuePublishJobs } from "@/lib/campaigns/publish-queue";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const payload = await readRequestPayload(req);
    const redirectTo =
      typeof payload.redirectTo === "string" ? payload.redirectTo : null;
    const limit =
      typeof payload.limit === "string" && payload.limit
        ? Number(payload.limit)
        : undefined;

    const admin = getAdminSupabase();
    const result = await runDuePublishJobs({
      admin,
      triggeredBy: gate.userId,
      limit,
      lockOwner: gate.userId || "queue-admin",
      source: "admin",
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || "/admin/campaigns/queue",
      payload: {
        ok: true,
        result,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to run due publish jobs";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
