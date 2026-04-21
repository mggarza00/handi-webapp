import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { batchUpdateCampaigns } from "@/lib/campaigns/repository";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeCampaignIds(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return typeof value === "string" && value ? [value] : [];
}

function isBatchAction(
  value: string,
): value is "approve" | "reject" | "archive" {
  return value === "approve" || value === "reject" || value === "archive";
}

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const payload = await readRequestPayload(req);
    const redirectTo =
      typeof payload.redirectTo === "string" ? payload.redirectTo : null;
    const action = typeof payload.action === "string" ? payload.action : "";
    const note =
      typeof payload.note === "string"
        ? payload.note
        : typeof payload.feedback_note === "string"
          ? payload.feedback_note
          : "";
    const campaignIds = normalizeCampaignIds(payload.campaignIds);

    if (!isBatchAction(action)) {
      return NextResponse.json(
        { ok: false, error: "invalid_action" },
        { status: 422, headers: JSONH },
      );
    }

    if (!campaignIds.length) {
      return NextResponse.json(
        { ok: false, error: "campaign_ids_required" },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const updatedIds = await batchUpdateCampaigns(admin, {
      campaignIds,
      action,
      note,
      createdBy: gate.userId,
    });

    await Promise.all(
      updatedIds.map((campaignId) =>
        logAudit({
          actorId: gate.userId,
          action:
            action === "approve"
              ? "CAMPAIGN_APPROVED"
              : action === "reject"
                ? "CAMPAIGN_REJECTED"
                : "CAMPAIGN_ARCHIVED",
          entity: "campaign_drafts",
          entityId: campaignId,
          meta: {
            note,
            source: "batch",
          },
        }),
      ),
    );

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || "/admin/campaigns",
      payload: {
        ok: true,
        action,
        updatedIds,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to run batch action";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
