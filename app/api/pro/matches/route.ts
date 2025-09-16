import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { getUserOrThrow } from "@/lib/_supabase-server";
import type { Database } from "@/types/supabase";

type UUID = string;

type MatchItem = {
  id: UUID;
  created_at: string;
  source: "application" | "agreement" | "recent_profile";
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    await getUserOrThrow(supabase);

    const list: MatchItem[] = [];

    return NextResponse.json(
      { ok: true, data: list },
      { headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
  } catch (e: unknown) {
    const msg = errorMessage(e);
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { ok: false, error: msg },
      {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }
}
