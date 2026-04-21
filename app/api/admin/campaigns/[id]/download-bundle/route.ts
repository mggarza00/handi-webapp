import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { buildCampaignCreativeDownloadBundle } from "@/lib/creative/export-bundles";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const admin = getAdminSupabase();
    const bundle = await buildCampaignCreativeDownloadBundle({
      admin,
      campaignId: params.id,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_BUNDLE_DOWNLOAD_GENERATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: "Campaign download bundle generated for operational handoff.",
        scope: "campaign",
        includedChannels: bundle.includedChannels,
        blockedChannels: bundle.blockedChannels,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "PLACEMENT_READINESS_EVALUATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note:
          typeof bundle.manifest.placement_coverage === "object"
            ? "Placement readiness was included in the campaign download bundle."
            : "Campaign download bundle evaluated placement readiness.",
        scope: "campaign",
      },
    });
    if (bundle.warnings.length) {
      await logAudit({
        actorId: gate.userId,
        action: "CREATIVE_BUNDLE_DOWNLOAD_WARNING_EMITTED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: bundle.warnings.join(" | "),
          scope: "campaign",
        },
      });
    }
    await logAudit({
      actorId: gate.userId,
      action: "PLACEMENT_BUNDLE_DOWNLOADED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: "Campaign download bundle includes placement-aware handoff metadata.",
        scope: "campaign",
        includedChannels: bundle.includedChannels,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_BUNDLE_DOWNLOADED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: "Campaign download bundle downloaded.",
        scope: "campaign",
        includedChannels: bundle.includedChannels,
      },
    });

    return new NextResponse(bundle.buffer, {
      status: 200,
      headers: {
        "Content-Type": bundle.contentType,
        "Content-Disposition": `attachment; filename="${bundle.fileName}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to generate campaign download bundle";
    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_BUNDLE_DOWNLOAD_BLOCKED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: message,
        scope: "campaign",
      },
    });
    return NextResponse.json(
      { ok: false, error: "bundle_download_blocked", detail: message },
      { status: 409, headers: JSONH },
    );
  }
}
