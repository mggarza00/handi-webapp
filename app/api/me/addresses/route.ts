import { NextResponse } from "next/server";
import getRouteClient from "@/lib/supabase/route-client";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const hasEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) return NextResponse.json({ ok: true, items: [] }, { status: 200, headers: JSONH });
    const supabase = getRouteClient() as any;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) return NextResponse.json({ ok: true, items: [] }, { status: 200, headers: JSONH });

    const { data, error } = await supabase
      .from("user_addresses")
      .select("id,address,city,postal_code,label,lat,lon,times_used,last_used_at")
      .eq("profile_id", userId)
      .order("last_used_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ ok: true, items: data ?? [] }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

