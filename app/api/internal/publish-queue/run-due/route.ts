import { NextResponse } from "next/server";

import { JSONH } from "@/lib/auth-admin";
import { readRequestPayload } from "@/lib/campaigns/http";
import { runDuePublishJobs } from "@/lib/campaigns/publish-queue";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const secret = (
    process.env.PUBLISH_QUEUE_CRON_SECRET ||
    process.env.CRON_SECRET ||
    ""
  ).trim();
  if (!secret) {
    return { ok: false, status: 503, detail: "missing_publish_queue_secret" };
  }

  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== secret) {
    return { ok: false, status: 403, detail: "invalid_publish_queue_secret" };
  }

  return { ok: true as const };
}

export async function POST(req: Request) {
  const auth = isAuthorized(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.detail },
      { status: auth.status, headers: JSONH },
    );
  }

  try {
    const payload = await readRequestPayload(req);
    const limit =
      typeof payload.limit === "string" && payload.limit
        ? Number(payload.limit)
        : undefined;

    const admin = getAdminSupabase();
    const result = await runDuePublishJobs({
      admin,
      triggeredBy: null,
      limit,
      lockOwner: "publish-queue-cron",
      source: "cron",
    });

    return NextResponse.json(
      {
        ok: true,
        result,
      },
      { headers: JSONH },
    );
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "failed_to_run_publish_queue_due_jobs";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail },
      { status: 500, headers: JSONH },
    );
  }
}
