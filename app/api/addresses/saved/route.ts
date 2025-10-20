import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: NextRequest) {
  try {
    const hasEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      return NextResponse.json({ ok: true, data: [] }, { status: 200, headers: JSONH });
    }
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) return NextResponse.json({ ok: true, data: [] }, { status: 200, headers: JSONH });

    // Use "any" table name to avoid typing mismatch if the generated types aren't updated yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supaAny = supabase as any;
    const { data, error } = await supaAny
      .from("user_saved_addresses")
      .select("label,address_line,address_place_id,lat,lng,last_used_at,times_used")
      .eq("user_id", userId)
      .order("last_used_at", { ascending: false })
      .limit(10);
    if (error) {
      return NextResponse.json({ ok: true, data: [] }, { status: 200, headers: JSONH });
    }
    return NextResponse.json({ ok: true, data: data ?? [] }, { status: 200, headers: JSONH });
  } catch {
    return NextResponse.json({ ok: true, data: [] }, { status: 200, headers: JSONH });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
