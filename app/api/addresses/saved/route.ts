import { NextRequest, NextResponse } from "next/server";

import createClient from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";

type SavedAddressRow = Pick<
  Database["public"]["Tables"]["user_saved_addresses"]["Row"],
  "label" | "address_line" | "address_place_id" | "lat" | "lng" | "last_used_at" | "times_used"
>;

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: NextRequest) {
  try {
    const hasEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      return NextResponse.json({ ok: true, data: [] }, { status: 200, headers: JSONH });
    }
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) return NextResponse.json({ ok: true, data: [] }, { status: 200, headers: JSONH });

    const { data, error } = await supabase
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
