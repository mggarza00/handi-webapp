import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST() {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 401, headers: JSONH },
      );
    }

    const user = session?.user ?? null;

    return NextResponse.json(
      {
        ok: Boolean(user),
        user,
        session: session ? { expires_at: session.expires_at } : null,
      },
      { headers: JSONH },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
