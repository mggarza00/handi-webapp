import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { buildCampaignCreativeExportPackage } from "@/lib/creative/export-packages";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const url = new URL(req.url);
    const download = url.searchParams.get("download") === "1";
    const admin = getAdminSupabase();
    const pkg = await buildCampaignCreativeExportPackage({
      admin,
      campaignId: params.id,
    });

    await logAudit({
      actorId: gate.userId,
      action: download
        ? "CREATIVE_EXPORT_PACKAGE_DOWNLOADED"
        : "CREATIVE_EXPORT_PACKAGE_GENERATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: download
          ? "Campaign creative export package downloaded."
          : "Campaign creative export package generated.",
        scope: "campaign",
        blockedChannels: pkg.visualReadiness.blockedCount,
        missingChannels: pkg.visualReadiness.missingCount,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "VISUAL_READINESS_EVALUATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: pkg.visualReadiness.summary,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "ANALYTICS_CONTRACTS_UPDATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: "Campaign export package includes tracking contracts compatible with GA4 and Clarity.",
        scope: "campaign",
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "ATTRIBUTION_MAPPING_PREPARED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: "Campaign-level attribution and UTM mapping prepared for export handoff.",
        scope: "campaign",
      },
    });
    if (pkg.visualReadiness.blockedCount || pkg.visualReadiness.missingCount) {
      await logAudit({
        actorId: gate.userId,
        action: "VISUAL_READINESS_BLOCKED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: pkg.visualReadiness.summary,
        },
      });
    }
    if (
      pkg.placementCoverage.blockedCount ||
      pkg.placementCoverage.missingCount
    ) {
      await logAudit({
        actorId: gate.userId,
        action: "PLACEMENT_MISSING_DETECTED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: pkg.placementCoverage.summary,
          scope: "campaign",
        },
      });
    }

    const body = JSON.stringify({ ok: true, package: pkg }, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        ...JSONH,
        "Content-Disposition": download
          ? `attachment; filename="${pkg.campaignId}-creative-export-package.json"`
          : "inline",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to generate campaign export package";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
