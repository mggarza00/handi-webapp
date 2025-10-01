import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const adminAuth = await assertAdminOrJson();
  if (!adminAuth.ok) return adminAuth.res;
  const reviewerId = adminAuth.userId;
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400, headers: JSONH });

  let notes: string | null = null;
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as { review_notes?: string; reason?: string } | null;
      notes = (body?.review_notes || body?.reason || "").trim() || null;
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      notes = ((fd.get("review_notes") as string | null) || (fd.get("reason") as string | null) || "").trim() || null;
    }
  } catch {
    // ignore
  }

  const supa = createRouteHandlerClient<Database>({ cookies });
  const { error } = await supa
    .from("profile_change_requests")
    .update({ status: "rejected", reviewer_id: reviewerId, reviewed_at: new Date().toISOString(), review_notes: notes ?? undefined })
    .eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: "STATUS_UPDATE_FAILED" }, { status: 400, headers: JSONH });

  return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
}
