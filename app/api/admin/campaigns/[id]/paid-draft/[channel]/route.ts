import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { logAudit } from "@/lib/log-audit";
import {
  buildChannelPaidDraft,
  buildPlacementPaidDraft,
  type PaidDraftChannel,
} from "@/lib/publish/drafts";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPPORTED_CHANNELS = new Set<PaidDraftChannel>(["meta", "google"]);

export async function GET(
  req: Request,
  { params }: { params: { id: string; channel: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  if (!SUPPORTED_CHANNELS.has(params.channel as PaidDraftChannel)) {
    return NextResponse.json(
      { ok: false, error: "invalid_paid_draft_channel" },
      { status: 422, headers: JSONH },
    );
  }

  try {
    const url = new URL(req.url);
    const download = url.searchParams.get("download") === "1";
    const placementId = url.searchParams.get("placement");
    const admin = getAdminSupabase();

    if (placementId) {
      const draft = await buildPlacementPaidDraft({
        admin,
        campaignId: params.id,
        channel: params.channel as PaidDraftChannel,
        placementId,
      });

      await logAudit({
        actorId: gate.userId,
        action: download ? "PAID_DRAFT_DOWNLOADED" : "PAID_DRAFT_GENERATED",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: `${draft.platform} paid placement draft ${download ? "downloaded" : "generated"} for ${draft.placementId}.`,
          scope: "placement",
          channel: draft.channel,
          placementId: draft.placementId,
        },
      });
      await logAudit({
        actorId: gate.userId,
        action: draft.readiness.blocked
          ? "PAID_DRAFT_BLOCKED"
          : draft.readiness.warnings.length
            ? "PAID_DRAFT_WARNING_EMITTED"
            : "PAID_PLACEMENT_READY",
        entity: "campaign_drafts",
        entityId: params.id,
        meta: {
          note: draft.readiness.warnings.join(" | ") || draft.readiness.summary,
          scope: "placement",
          channel: draft.channel,
          placementId: draft.placementId,
        },
      });

      if (draft.readiness.blocked) {
        return NextResponse.json(
          {
            ok: false,
            error: "paid_draft_blocked",
            detail: draft.readiness.summary,
            draft,
          },
          { status: 409, headers: JSONH },
        );
      }

      const body = JSON.stringify({ ok: true, draft }, null, 2);
      return new NextResponse(body, {
        status: 200,
        headers: {
          ...JSONH,
          "Content-Disposition": download
            ? `attachment; filename="${draft.naming.recommendedFileStem}.json"`
            : "inline",
        },
      });
    }

    const draft = await buildChannelPaidDraft({
      admin,
      campaignId: params.id,
      channel: params.channel as PaidDraftChannel,
    });

    await logAudit({
      actorId: gate.userId,
      action: download ? "PAID_DRAFT_DOWNLOADED" : "PAID_DRAFT_GENERATED",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: `${draft.platform} paid channel draft ${download ? "downloaded" : "generated"}.`,
        scope: "channel",
        channel: draft.channel,
      },
    });
    await logAudit({
      actorId: gate.userId,
      action: draft.summary.blockedPlacements
        ? "PAID_DRAFT_WARNING_EMITTED"
        : "PAID_PLACEMENT_READY",
      entity: "campaign_drafts",
      entityId: params.id,
      meta: {
        note: draft.notes.join(" | "),
        scope: "channel",
        channel: draft.channel,
      },
    });

    const body = JSON.stringify({ ok: true, draft }, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        ...JSONH,
        "Content-Disposition": download
          ? `attachment; filename="${draft.platform}-${draft.channel}-paid-draft.json"`
          : "inline",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to build paid draft";
    await logAudit({
      actorId: gate.userId,
      action: "PAID_DRAFT_BLOCKED",
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
      { ok: false, error: "paid_draft_blocked", detail: message },
      { status: 409, headers: JSONH },
    );
  }
}
