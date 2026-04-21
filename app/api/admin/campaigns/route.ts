import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import {
  coerceAudienceFilter,
  coerceCampaignSortOrder,
  coerceCampaignStatus,
  coerceChannelFilter,
  coerceGoalFilter,
} from "@/lib/campaigns/workflow";
import { listCampaignDrafts } from "@/lib/campaigns/repository";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const admin = getAdminSupabase();
    const url = new URL(req.url);
    const result = await listCampaignDrafts(admin, {
      status: coerceCampaignStatus(url.searchParams.get("status")),
      audience: coerceAudienceFilter(url.searchParams.get("audience")),
      channel: coerceChannelFilter(url.searchParams.get("channel")),
      goal: coerceGoalFilter(url.searchParams.get("goal")),
      owner:
        url.searchParams.get("owner") === "unassigned"
          ? "unassigned"
          : url.searchParams.get("owner") || "",
      q: url.searchParams.get("q") || "",
      sort: coerceCampaignSortOrder(url.searchParams.get("sort")),
      page: Number(url.searchParams.get("page") || "1"),
      pageSize: Number(url.searchParams.get("pageSize") || "20"),
    });

    return NextResponse.json({ ok: true, ...result }, { headers: JSONH });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to list campaigns";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
