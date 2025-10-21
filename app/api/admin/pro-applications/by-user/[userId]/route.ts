/* eslint-disable import/order */
import { NextResponse } from "next/server";

import { getAdminSupabase } from "../../../../../../lib/supabase/admin";
import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";

// JSONH imported from helper

export async function GET(
  _req: Request,
  { params }: { params: { userId: string } },
) {
  const guard = await assertAdminOrJson();
  if (!guard.ok) return guard.res;
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("pro_applications")
      .select("id,status,created_at,updated_at,user_id")
      .eq("user_id", params.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, data }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}
