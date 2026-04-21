import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { listCreativeAssetJobs } from "@/lib/creative/repository";
import { normalizeCreativeGenerationStatus } from "@/lib/creative/workflow";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  try {
    const { searchParams } = new URL(req.url);
    const admin = getAdminSupabase();
    const result = await listCreativeAssetJobs(admin, {
      q: searchParams.get("q") || "",
      status: searchParams.get("status")
        ? normalizeCreativeGenerationStatus(searchParams.get("status"))
        : "",
      channel: (searchParams.get("channel") || "") as
        | "meta"
        | "email"
        | "whatsapp"
        | "push"
        | "landing"
        | "google"
        | "",
      provider: searchParams.get("provider") || "",
      campaignId: searchParams.get("campaignId") || undefined,
      page: Number(searchParams.get("page") || 1),
      pageSize: Number(searchParams.get("pageSize") || 20),
    });

    return NextResponse.json({ ok: true, ...result }, { headers: JSONH });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to list creative asset jobs";
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500, headers: JSONH },
    );
  }
}
