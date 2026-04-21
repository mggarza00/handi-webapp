import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  buildChannelCreativeExportPackage,
  buildPlacementCreativeExportPackage,
} from "@/lib/creative/export-packages";
import { getCreativePlacementsForChannel } from "@/lib/creative/placements";
import { isVisualReadinessBlocked } from "@/lib/creative/readiness";
import { type PublishChannel } from "@/lib/campaigns/workflow";
import { logAudit } from "@/lib/log-audit";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPPORTED_CHANNELS = new Set<PublishChannel>([
  "email",
  "push",
  "whatsapp",
  "meta",
  "landing",
  "google",
]);

export async function GET(
  req: Request,
  { params }: { params: { id: string; channel: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    if (!SUPPORTED_CHANNELS.has(params.channel as PublishChannel)) {
      return NextResponse.json(
        { ok: false, error: "invalid_channel" },
        { status: 422, headers: JSONH },
      );
    }

    const url = new URL(req.url);
    const download = url.searchParams.get("download") === "1";
    const placementId = url.searchParams.get("placement");
    const admin = getAdminSupabase();

    if (placementId) {
      const placement = getCreativePlacementsForChannel(
        params.channel as PublishChannel,
      ).find((item) => item.id === placementId);

      if (!placement) {
        return NextResponse.json(
          { ok: false, error: "invalid_placement" },
          { status: 422, headers: JSONH },
        );
      }

      const pkg = await buildPlacementCreativeExportPackage({
        admin,
        campaignId: params.id,
        channel: params.channel as PublishChannel,
        placementId: placement.id,
      });

      await logAudit({
        actorId: gate.userId,
        action: "PLACEMENT_EXPORT_GENERATED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: `${pkg.placementLabel} export package ${download ? "downloaded" : "generated"}.`,
          scope: "placement",
          channel: pkg.channel,
          placementId: pkg.placementId,
        },
      });
      await logAudit({
        actorId: gate.userId,
        action: "PLACEMENT_READINESS_EVALUATED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: pkg.placementReadiness.summary,
          scope: "placement",
          channel: pkg.channel,
          placementId: pkg.placementId,
        },
      });
      await logAudit({
        actorId: gate.userId,
        action: "ATTRIBUTION_MAPPING_PREPARED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: `Attribution mapping prepared for ${pkg.placementLabel}.`,
          scope: "placement",
          channel: pkg.channel,
          placementId: pkg.placementId,
        },
      });
      if (
        pkg.placementReadiness.isBlocked ||
        pkg.placementReadiness.state === "missing"
      ) {
        await logAudit({
          actorId: gate.userId,
          action: "PLACEMENT_MISSING_DETECTED",
          entity: "campaign_drafts",
          entityId: params.id,
          meta: {
            note: pkg.placementReadiness.summary,
            scope: "placement",
            channel: pkg.channel,
            placementId: pkg.placementId,
          },
        });
      }

      const body = JSON.stringify({ ok: true, package: pkg }, null, 2);
      return new NextResponse(body, {
        status: 200,
        headers: {
          ...JSONH,
          "Content-Disposition": download
            ? `attachment; filename="${pkg.suggestedFilenames.json}"`
            : "inline",
        },
      });
    }

    const pkg = await buildChannelCreativeExportPackage({
      admin,
      campaignId: params.id,
      channel: params.channel as PublishChannel,
    });

    await logAudit({
      actorId: gate.userId,
      action: download
        ? "CREATIVE_EXPORT_PACKAGE_DOWNLOADED"
        : "CREATIVE_EXPORT_PACKAGE_GENERATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: `${pkg.channel} creative export package ${download ? "downloaded" : "generated"}.`,
        scope: "channel",
        channel: pkg.channel,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "VISUAL_READINESS_EVALUATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: pkg.visualReadiness.summary,
        channel: pkg.channel,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "PLACEMENT_READINESS_EVALUATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: pkg.placementCoverage.summary,
        scope: "channel",
        channel: pkg.channel,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: "ATTRIBUTION_MAPPING_PREPARED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: `Tracking contract and placement-aware UTM mapping prepared for ${pkg.channel}.`,
        scope: "channel",
        channel: pkg.channel,
      },
    });
    if (isVisualReadinessBlocked(pkg.visualReadiness)) {
      await logAudit({
        actorId: gate.userId,
        action: "VISUAL_READINESS_BLOCKED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: pkg.visualReadiness.summary,
          channel: pkg.channel,
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
          scope: "channel",
          channel: pkg.channel,
        },
      });
    }

    const body = JSON.stringify({ ok: true, package: pkg }, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        ...JSONH,
        "Content-Disposition": download
          ? `attachment; filename="${pkg.suggestedFilenames.json}"`
          : "inline",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to generate channel export package";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
