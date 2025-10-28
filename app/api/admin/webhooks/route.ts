import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data, error } = await supabase
    .from("webhook_events")
    .select("id, provider, event, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
  return NextResponse.json({ ok: true, items: data }, { headers: JSONH });
}
