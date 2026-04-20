import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  readRequestPayload,
  respondWithRedirectOrJson,
} from "@/lib/campaigns/http";
import { createCreativeAssetJob } from "@/lib/creative/repository";
import { creativeGenerateInputSchema } from "@/lib/creative/schemas";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const raw = await readRequestPayload(req);
    const parsed = creativeGenerateInputSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_payload",
          detail: parsed.error.flatten(),
        },
        { status: 422, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const result = await createCreativeAssetJob({
      admin,
      campaignDraftId: parsed.data.campaignDraftId,
      campaignMessageId: parsed.data.campaignMessageId,
      channel: parsed.data.channel,
      format: parsed.data.format,
      notes: parsed.data.notes,
      variantCount: parsed.data.variantCount,
      createdBy: gate.userId,
    });
    const providerMetadata = result.job.provider_metadata;

    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_ASSET_JOB_CREATED",
      entity: "campaign_drafts",
      entityId: result.campaignDraftId,
      meta: {
        creativeAssetJobId: result.job.id,
        messageId: result.campaignMessageId,
        channel: result.job.channel,
        note: result.job.brief_summary,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_ASSET_GENERATED",
      entity: "campaign_drafts",
      entityId: result.campaignDraftId,
      meta: {
        creativeAssetJobId: result.job.id,
        messageId: result.campaignMessageId,
        channel: result.job.channel,
        assetCount: result.assets.length,
        providerName: result.job.provider_name,
        generationMode: result.job.provider_mode,
        model: providerMetadata?.model || null,
        fallbackReason: providerMetadata?.fallbackReason || null,
        requestId: providerMetadata?.requestId || null,
        note: result.job.rationale_summary,
      },
    });

    return respondWithRedirectOrJson({
      req,
      redirectTo:
        parsed.data.redirectTo || `/admin/creative-assets/${result.job.id}`,
      payload: {
        ok: true,
        creativeAssetJobId: result.job.id,
        campaignDraftId: result.campaignDraftId,
        campaignMessageId: result.campaignMessageId,
        job: result.job,
        assets: result.assets,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to generate assets";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: JSONH },
  );
}
