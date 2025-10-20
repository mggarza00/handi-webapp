import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: NextRequest) {
  try {
    const hasEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      return NextResponse.json({ ok: true, items: [] }, { status: 200, headers: JSONH });
    }
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) return NextResponse.json({ ok: true, items: [] }, { status: 200, headers: JSONH });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supaAny = supabase as any;
    const { data, error } = await supaAny
      .from("user_addresses")
      .select("id,address,city,lat,lon,postal_code,label,last_used_at")
      .eq("profile_id", userId)
      .order("last_used_at", { ascending: false })
      .limit(5);
    if (error) {
      return NextResponse.json({ ok: true, items: [] }, { status: 200, headers: JSONH });
    }
    const items = Array.isArray(data) ? data.map((r) => ({
      id: r.id,
      address: r.address,
      city: r.city,
      lat: r.lat,
      lon: r.lon,
      postal_code: r.postal_code,
      label: r.label,
    })) : [];
    return NextResponse.json({ ok: true, items }, { status: 200, headers: JSONH });
  } catch {
    return NextResponse.json({ ok: true, items: [] }, { status: 200, headers: JSONH });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
