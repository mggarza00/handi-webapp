import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET() {
  const { user } = await getAuthContext();

  if (!user) {
    return new NextResponse(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), {
      status: 401,
      headers: JSONH,
    });
  }

  return NextResponse.json(
    { ok: true, user_id: user.id, email: user.email ?? null },
    { headers: JSONH },
  );
}
