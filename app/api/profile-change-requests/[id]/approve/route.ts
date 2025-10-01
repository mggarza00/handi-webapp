import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const adminAuth = await assertAdminOrJson();
  if (!adminAuth.ok) return adminAuth.res;
  const reviewerId = adminAuth.userId;
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400, headers: JSONH });

  const supa = createRouteHandlerClient<Database>({ cookies });
  // Fetch the change request
  const { data: req, error } = await supa
    .from("profile_change_requests")
    .select("id, user_id, status, payload")
    .eq("id", id)
    .maybeSingle();
  if (error || !req) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: JSONH });
  if ((req as any).status !== "pending")
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400, headers: JSONH });

  const payload = (req as unknown as { payload?: unknown })?.payload as
    | { profiles?: Record<string, unknown>; professionals?: Record<string, unknown> }
    | null
    | undefined;
  const userId = (req as unknown as { user_id?: string }).user_id as string;
  if (!payload || (!payload.profiles && !payload.professionals)) {
    return NextResponse.json({ ok: false, error: "EMPTY_PAYLOAD" }, { status: 400, headers: JSONH });
  }

  // Apply changes (best-effort; PostgREST lacks multi-statement transactions)
  if (payload.profiles && Object.keys(payload.profiles).length > 0) {
    const { error: up1 } = await supa
      .from("profiles")
      .update(payload.profiles as Database["public"]["Tables"]["profiles"]["Update"])
      .eq("id", userId);
    if (up1) return NextResponse.json({ ok: false, error: "PROFILE_UPDATE_FAILED" }, { status: 400, headers: JSONH });
  }
  if (payload.professionals && Object.keys(payload.professionals).length > 0) {
    const { error: up2 } = await supa
      .from("professionals")
      .update(payload.professionals as Database["public"]["Tables"]["professionals"]["Update"])
      .eq("id", userId);
    if (up2) return NextResponse.json({ ok: false, error: "PRO_UPDATE_FAILED" }, { status: 400, headers: JSONH });
  }

  const { error: upReq } = await supa
    .from("profile_change_requests")
    .update({ status: "approved", reviewer_id: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (upReq) return NextResponse.json({ ok: false, error: "STATUS_UPDATE_FAILED" }, { status: 400, headers: JSONH });

  return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
}

