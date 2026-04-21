import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  analyticsIngestSchema,
  ingestCampaignAnalytics,
} from "@/lib/campaigns/analytics";
import { refreshCampaignLearningLoop } from "@/lib/campaigns/analytics-refresh";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = analyticsIngestSchema.safeParse(raw);

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
    const ingest = await ingestCampaignAnalytics(admin, parsed.data);

    const campaignResults = await Promise.all(
      ingest.affectedCampaignIds.map(async (campaignId) => {
        return refreshCampaignLearningLoop({
          admin,
          campaignId,
          actorId: gate.userId,
          metricsIngested: ingest.metricsIngested,
          eventsIngested: ingest.eventsIngested,
          metricSources: ingest.metricSources,
          eventSources: ingest.eventSources,
          note: `Ingested ${ingest.metricsIngested} metric snapshot(s) and ${ingest.eventsIngested} event(s).`,
        });
      }),
    );

    return NextResponse.json(
      {
        ok: true,
        metricsIngested: ingest.metricsIngested,
        eventsIngested: ingest.eventsIngested,
        affectedCampaignIds: ingest.affectedCampaignIds,
        campaigns: campaignResults,
      },
      { headers: JSONH },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to ingest analytics";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
