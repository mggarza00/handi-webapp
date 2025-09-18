import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { id: requestId } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("agreements")
    .select("id, professional_id, amount, status, created_at, updated_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) {
    return new NextResponse(
      JSON.stringify({
        ok: false,
        error: "LIST_FAILED",
        detail: error.message,
      }),
      { status: 400, headers: JSONH },
    );
  }

  return NextResponse.json({ ok: true, data }, { headers: JSONH });
}
