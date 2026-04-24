import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  buildChannelCreativeDownloadBundle,
  buildPlacementCreativeDownloadBundle,
} from "@/lib/creative/export-bundles";
import { getCreativePlacementsForChannel } from "@/lib/creative/placements";
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

  if (!SUPPORTED_CHANNELS.has(params.channel as PublishChannel)) {
    return NextResponse.json(
      { ok: false, error: "invalid_channel" },
      { status: 422, headers: JSONH },
    );
  }

  try {
    const url = new URL(req.url);
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

      const bundle = await buildPlacementCreativeDownloadBundle({
        admin,
        campaignId: params.id,
        channel: params.channel,
        placementId: placement.id,
      });

      await logAudit({
        actorId: gate.userId,
        action: "PLACEMENT_BUNDLE_DOWNLOADED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: `${placement.label} download bundle downloaded.`,
          scope: "placement",
          channel: params.channel,
          placementId: placement.id,
          warnings: bundle.warnings,
        },
      });
      await logAudit({
        actorId: gate.userId,
        action:
          bundle.manifest.copy &&
          typeof bundle.manifest.copy === "object" &&
          "inheritedFromChannel" in
            (bundle.manifest.copy as Record<string, unknown>) &&
          (bundle.manifest.copy as Record<string, unknown>)
            .inheritedFromChannel === true
            ? "PLACEMENT_COPY_INHERITED"
            : "PLACEMENT_COPY_USED_IN_EXPORT",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: `Placement download bundle prepared for ${placement.id}.`,
          scope: "placement",
          channel: params.channel,
          placementId: placement.id,
        },
      });
      if (
        bundle.manifest.paid_handoff &&
        typeof bundle.manifest.paid_handoff === "object"
      ) {
        const paidHandoff = bundle.manifest.paid_handoff as Record<
          string,
          unknown
        >;
        const warnings = Array.isArray(paidHandoff.warnings)
          ? paidHandoff.warnings.filter(
              (item): item is string => typeof item === "string",
            )
          : [];
        const readiness = paidHandoff.readiness as
          | Record<string, unknown>
          | undefined;
        const isReadyForPaidHandoff =
          readiness &&
          typeof readiness.isReadyForPaidHandoff === "boolean" &&
          readiness.isReadyForPaidHandoff;

        await logAudit({
          actorId: gate.userId,
          action: "PAID_HANDOFF_EXPORTED",
          entity: "campaign_drafts",
          entityId: params.id,
          meta: {
            note: `${placement.label} paid handoff ZIP exported.`,
            scope: "placement",
            channel: params.channel,
            placementId: placement.id,
          },
        });
        await logAudit({
          actorId: gate.userId,
          action: "PAID_DRAFT_INCLUDED_IN_BUNDLE",
          entity: "campaign_drafts",
          entityId: params.id,
          meta: {
            note: `${placement.label} bundle includes a paid draft payload.`,
            scope: "placement",
            channel: params.channel,
            placementId: placement.id,
          },
        });
        await logAudit({
          actorId: gate.userId,
          action: isReadyForPaidHandoff
            ? "PAID_PLACEMENT_READY"
            : "PAID_PLACEMENT_WARNING_EMITTED",
          entity: "campaign_drafts",
          entityId: params.id,
          meta: {
            note:
              warnings.join(" | ") ||
              `${placement.label} paid handoff ZIP generated with current placement state.`,
            scope: "placement",
            channel: params.channel,
            placementId: placement.id,
          },
        });
      }

      return new NextResponse(bundle.buffer, {
        status: 200,
        headers: {
          "Content-Type": bundle.contentType,
          "Content-Disposition": `attachment; filename="${bundle.fileName}"`,
        },
      });
    }

    const bundle = await buildChannelCreativeDownloadBundle({
      admin,
      campaignId: params.id,
      channel: params.channel,
    });

    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_BUNDLE_DOWNLOAD_GENERATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: `${bundle.channel} download bundle generated for operational handoff.`,
        scope: "channel",
        channel: bundle.channel,
        warnings: bundle.warnings,
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
          scope: "channel",
          channel: bundle.channel,
        },
      });
    }
    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_BUNDLE_DOWNLOADED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: `${bundle.channel} download bundle downloaded.`,
        scope: "channel",
        channel: bundle.channel,
        warnings: bundle.warnings,
      },
    });
    if (bundle.channel === "meta" || bundle.channel === "google") {
      await logAudit({
        actorId: gate.userId,
        action: "PAID_HANDOFF_EXPORTED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: `${bundle.channel} paid handoff ZIP exported.`,
          scope: "channel",
          channel: bundle.channel,
        },
      });
      await logAudit({
        actorId: gate.userId,
        action: "PAID_DRAFT_INCLUDED_IN_BUNDLE",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: `${bundle.channel} bundle includes a paid draft payload.`,
          scope: "channel",
          channel: bundle.channel,
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
            `${bundle.channel} paid bundle is ready for manual handoff.`,
          scope: "channel",
          channel: bundle.channel,
        },
      });
    }

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
        : "failed to generate channel download bundle";
    await logAudit({
      actorId: gate.userId,
      action: "CREATIVE_BUNDLE_DOWNLOAD_BLOCKED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: message,
        scope: "channel",
        channel: params.channel,
        placementId: new URL(req.url).searchParams.get("placement"),
      },
    });
    return NextResponse.json(
      { ok: false, error: "bundle_download_blocked", detail: message },
      { status: 409, headers: JSONH },
    );
  }
}
