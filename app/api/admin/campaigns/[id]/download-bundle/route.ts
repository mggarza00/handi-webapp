import { NextResponse } from "next/server";

import { trackServerAnalyticsEvent } from "@/lib/analytics/server-events";
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
    const visualReadiness =
      bundle.manifest &&
      typeof bundle.manifest === "object" &&
      "visual_readiness" in bundle.manifest &&
      bundle.manifest.visual_readiness &&
      typeof bundle.manifest.visual_readiness === "object"
        ? (bundle.manifest.visual_readiness as { overallState?: string })
        : null;

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
    const paidChannels = bundle.includedChannels.filter(
      (channel) => channel === "meta" || channel === "google",
    );
    if (paidChannels.length) {
      await logAudit({
        actorId: gate.userId,
        action: "PAID_HANDOFF_EXPORTED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: `Campaign paid handoff ZIP exported for ${paidChannels.join(", ")}.`,
          scope: "campaign",
        },
      });
      await logAudit({
        actorId: gate.userId,
        action: "PAID_DRAFT_INCLUDED_IN_BUNDLE",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: `Campaign ZIP includes paid draft payloads for ${paidChannels.join(", ")}.`,
          scope: "campaign",
        },
      });
      await logAudit({
        actorId: gate.userId,
        action: bundle.warnings.length
          ? "PAID_PLACEMENT_WARNING_EMITTED"
          : "PAID_PLACEMENT_READY",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note:
            bundle.warnings.join(" | ") ||
            "Campaign paid placements included in the ZIP are ready for manual handoff.",
          scope: "campaign",
        },
      });
      if (
        bundle.blockedChannels.some(
          (channel) => channel === "meta" || channel === "google",
        )
      ) {
        await logAudit({
          actorId: gate.userId,
          action: "PAID_PLACEMENT_MISSING_DETECTED",
          entity: "campaign_drafts",
          entityId: params.id,
          meta: {
            note: `Some paid channels were omitted from the campaign ZIP: ${bundle.blockedChannels.join(", ")}.`,
            scope: "campaign",
          },
        });
      }
    }

    await trackServerAnalyticsEvent({
      name: "download_bundle_downloaded_confirmed",
      request: _req,
      userId: gate.userId,
      correlationId: `${params.id}:creative-download-bundle`,
      context: {
        campaign_id: params.id,
        readiness_status: visualReadiness?.overallState,
      },
      params: {
        export_scope: "campaign",
        included_channels: bundle.includedChannels.length,
        blocked_channels: bundle.blockedChannels.length,
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
