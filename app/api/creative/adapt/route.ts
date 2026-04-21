import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import {
  getCreativeFormatPreset,
  listCreativeFormatPresets,
} from "@/lib/creative/formats";
import { createCreativeAssetAdaptation } from "@/lib/creative/repository";
import { creativeAdaptInputSchema } from "@/lib/creative/schemas";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const presets = listCreativeFormatPresets();
  return NextResponse.json(
    {
      ok: true,
      formats: presets,
      methods: ["crop", "pad", "resize", "ai_extend", "provider_regenerate"],
    },
    { headers: JSONH },
  );
}

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const raw = await readRequestPayload(req);
    const parsed = creativeAdaptInputSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const result = await createCreativeAssetAdaptation({
      admin,
      sourceCreativeAssetId: parsed.data.sourceCreativeAssetId,
      targetChannel: parsed.data.targetChannel,
      format: parsed.data.format,
      width: parsed.data.width,
      height: parsed.data.height,
      adaptationMethod: parsed.data.adaptationMethod,
      feedbackNote: parsed.data.feedbackNote,
      createdBy: gate.userId,
    });
    const preset = getCreativeFormatPreset(parsed.data.format);

    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_ASSET_ADAPTATION_CREATED",
      entity: "campaign_drafts",
      entityId: result.campaignDraftId,
      meta: {
        creativeAssetJobId: result.creativeAssetJobId,
        creativeAssetId: result.creativeAssetId,
        parentCreativeAssetId: result.parentCreativeAssetId,
        channel: result.channel,
        format: parsed.data.format,
        width: parsed.data.width || preset.width,
        height: parsed.data.height || preset.height,
        note:
          parsed.data.feedbackNote?.trim() ||
          `Created ${preset.label.toLowerCase()} derivative from approved master asset.`,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_ASSET_VERSION_CREATED",
      entity: "campaign_drafts",
      entityId: result.campaignDraftId,
      meta: {
        creativeAssetJobId: result.creativeAssetJobId,
        creativeAssetId: result.creativeAssetId,
        parentCreativeAssetId: result.parentCreativeAssetId,
        channel: result.channel,
        note: "A new derivative asset version was created.",
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo:
        parsed.data.redirectTo ||
        `/admin/creative-assets/${result.creativeAssetJobId}`,
      payload: {
        ok: true,
        creativeAssetJobId: result.creativeAssetJobId,
        creativeAssetId: result.creativeAssetId,
        campaignDraftId: result.campaignDraftId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to adapt creative asset";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
