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
      await logAudit({
        actorId: gate.userId,
        action: pkg.copy.inheritedFromChannel
          ? "PLACEMENT_COPY_INHERITED"
          : "PLACEMENT_COPY_USED_IN_EXPORT",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: pkg.copy.inheritedFromChannel
            ? `${pkg.placementLabel} is still inheriting channel-level copy in export output.`
            : `${pkg.placementLabel} is using approved placement-specific copy in export output.`,
          scope: "placement",
          channel: pkg.channel,
          placementId: pkg.placementId,
          messageId: pkg.copy.baseMessageId,
          placementMessageId: pkg.copy.placementMessageId,
          placementCopySource: pkg.copy.source,
        },
      });
      if (pkg.paidHandoff.isPaidPlacement) {
        await logAudit({
          actorId: gate.userId,
          action: download ? "PAID_HANDOFF_EXPORTED" : "PAID_HANDOFF_GENERATED",
          entity: "campaign_drafts",
          entityId: params.id,
          meta: {
            note: `${pkg.paidHandoff.operationalName} paid handoff ${download ? "exported" : "generated"}.`,
            scope: "placement",
            channel: pkg.channel,
            placementId: pkg.placementId,
          },
        });
        await logAudit({
          actorId: gate.userId,
          action: pkg.paidHandoff.readiness.isReadyForPaidHandoff
            ? "PAID_PLACEMENT_READY"
            : "PAID_PLACEMENT_WARNING_EMITTED",
          entity: "campaign_drafts",
          entityId: params.id,
          meta: {
            note: pkg.paidHandoff.readiness.isReadyForPaidHandoff
              ? `${pkg.paidHandoff.operationalName} is ready for manual paid handoff.`
              : pkg.paidHandoff.warnings.join(" | ") ||
                `${pkg.paidHandoff.operationalName} requires manual review before paid handoff.`,
            scope: "placement",
            channel: pkg.channel,
            placementId: pkg.placementId,
          },
        });
        if (
          pkg.placementReadiness.state === "missing" ||
          pkg.placementReadiness.state === "blocked"
        ) {
          await logAudit({
            actorId: gate.userId,
            action: "PAID_PLACEMENT_MISSING_DETECTED",
            entity: "campaign_drafts",
            entityId: params.id,
            meta: {
              note:
                pkg.paidHandoff.warnings.join(" | ") ||
                pkg.placementReadiness.summary,
              scope: "placement",
              channel: pkg.channel,
              placementId: pkg.placementId,
            },
          });
        }
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
    if (pkg.channel === "meta" || pkg.channel === "google") {
      await logAudit({
        actorId: gate.userId,
        action: download ? "PAID_HANDOFF_EXPORTED" : "PAID_HANDOFF_GENERATED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: `${pkg.channel} paid handoff ${download ? "exported" : "generated"} at channel level.`,
          scope: "channel",
          channel: pkg.channel,
        },
      });
      if (
        pkg.placementCoverage.blockedCount ||
        pkg.placementCoverage.missingCount
      ) {
        await logAudit({
          actorId: gate.userId,
          action: "PAID_PLACEMENT_MISSING_DETECTED",
          entity: "campaign_drafts",
          entityId: params.id,
          meta: {
            note: pkg.placementCoverage.summary,
            scope: "channel",
            channel: pkg.channel,
          },
        });
      } else if (
        pkg.placementCoverage.fallbackCount ||
        pkg.placements.some(
          (placement) => placement.paidHandoff.warnings.length,
        )
      ) {
        await logAudit({
          actorId: gate.userId,
          action: "PAID_PLACEMENT_WARNING_EMITTED",
          entity: "campaign_drafts",
          entityId: params.id,
          meta: {
            note:
              pkg.placements
                .flatMap((placement) => placement.paidHandoff.warnings)
                .slice(0, 4)
                .join(" | ") || pkg.placementCoverage.summary,
            scope: "channel",
            channel: pkg.channel,
          },
        });
      } else {
        await logAudit({
          actorId: gate.userId,
          action: "PAID_PLACEMENT_READY",
          entity: "campaign_drafts",
          entityId: params.id,
          meta: {
            note: `${pkg.channel} paid placements are ready for manual handoff.`,
            scope: "channel",
            channel: pkg.channel,
          },
        });
      }
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
