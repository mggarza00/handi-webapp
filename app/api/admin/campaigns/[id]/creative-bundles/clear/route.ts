import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { labelChannel, type PublishChannel } from "@/lib/campaigns/workflow";
import { clearCampaignCreativeBundleOverride } from "@/lib/creative/bundles";
import { getAdminSupabase } from "@/lib/supabase/server";
import { logAudit } from "@/lib/log-audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPPORTED_BUNDLE_CHANNELS = new Set<PublishChannel>([
  "email",
  "push",
  "whatsapp",
  "meta",
  "landing",
  "google",
]);

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const payload = await readRequestPayload(req);
    const channel = typeof payload.channel === "string" ? payload.channel : "";
    const redirectTo =
      typeof payload.redirectTo === "string" ? payload.redirectTo : null;

    if (!channel) {
      return NextResponse.json(
        { ok: false, error: "channel_required" },
        { status: 422, headers: JSONH },
      );
    }
    if (!SUPPORTED_BUNDLE_CHANNELS.has(channel as PublishChannel)) {
      return NextResponse.json(
        { ok: false, error: "invalid_channel" },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const bundle = await clearCampaignCreativeBundleOverride({
      admin,
      campaignId: params.id,
      channel: channel as PublishChannel,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_BUNDLE_CLEARED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        channel: bundle.channel,
        note: `Creative bundle override cleared for ${labelChannel(bundle.channel)}.`,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action:
        bundle.suitability_status === "missing"
          ? "CREATIVE_BUNDLE_MISSING_DETECTED"
          : "CREATIVE_BUNDLE_RESOLVED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        channel: bundle.channel,
        status: bundle.suitability_status,
        note: bundle.summary,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo: redirectTo || `/admin/campaigns/${params.id}`,
      payload: { ok: true, bundle },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to clear creative bundle override";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
