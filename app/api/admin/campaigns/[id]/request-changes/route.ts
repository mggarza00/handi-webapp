import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { updateCampaignWorkflowStatus } from "@/lib/campaigns/repository";
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
    const note =
      typeof payload.feedbackNote === "string"
        ? payload.feedbackNote
        : typeof payload.feedback_note === "string"
          ? payload.feedback_note
          : "";
    const redirectTo =
      typeof payload.redirectTo === "string" ? payload.redirectTo : null;

    if (!note.trim()) {
      return NextResponse.json(
        { ok: false, error: "feedback_note_required" },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    await updateCampaignWorkflowStatus(admin, {
      campaignId: params.id,
      status: "changes_requested",
      feedbackType: "request_changes",
      feedbackNote: note,
      createdBy: gate.userId,
    });
    await logAudit({
      actorId: gate.userId,
      action: "CAMPAIGN_CHANGES_REQUESTED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: { note },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${params.id}`,
      payload: { ok: true, id: params.id, status: "changes_requested" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to request changes";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
