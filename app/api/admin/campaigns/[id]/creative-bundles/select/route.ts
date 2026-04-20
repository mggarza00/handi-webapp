import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { labelChannel, type PublishChannel } from "@/lib/campaigns/workflow";
import { selectCampaignCreativeBundleOverride } from "@/lib/creative/bundles";
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
    const creativeAssetId =
      typeof payload.creativeAssetId === "string"
        ? payload.creativeAssetId
        : "";
    const notes = typeof payload.notes === "string" ? payload.notes : "";
    const redirectTo =
      typeof payload.redirectTo === "string" ? payload.redirectTo : null;

    if (!channel || !creativeAssetId) {
      return NextResponse.json(
        { ok: false, error: "channel_and_asset_required" },
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
    const bundle = await selectCampaignCreativeBundleOverride({
      admin,
      campaignId: params.id,
      channel: channel as PublishChannel,
      creativeAssetId,
      notes,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_BUNDLE_MANUAL_OVERRIDE",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        channel: bundle.channel,
        selectedAssetId: bundle.selected_asset?.id || null,
        selectedMasterAssetId: bundle.selected_master_asset_id,
        selectedDerivativeAssetId: bundle.selected_derivative_asset_id,
        note:
          notes.trim() ||
          `Manual creative bundle override saved for ${labelChannel(bundle.channel)}.`,
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
        : "failed to save creative bundle override";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
