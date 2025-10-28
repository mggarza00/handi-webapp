/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { cookies } from "next/headers";
import createClient from "@/utils/supabase/server";
import { createPublicClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const c = cookies();
    const all = c.getAll();
    const cookieNames = all.map((x) => x.name);
    const route = createClient();
    const { data: rUser } = await route.auth.getUser();

    const authH = (req.headers.get("authorization") || req.headers.get("Authorization") || "").trim();
    let bearerUser: unknown = null;
    if (authH) {
      const m = authH.match(/^Bearer\s+(.+)$/i);
      const token = m?.[1] || "";
      if (token) {
        const pub = createPublicClient();
        const { data } = await pub.auth.getUser(token);
        bearerUser = data.user ?? null;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        cookieNames,
        cookieHasSb: cookieNames.some((n) => n.startsWith("sb-")),
        routeUserId: rUser.user?.id ?? null,
        hasAuthorizationHeader: !!authH,
        bearerUserId: (bearerUser as any)?.id ?? null,
      },
      { headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}
