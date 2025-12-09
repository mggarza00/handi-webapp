import { NextRequest, NextResponse } from "next/server";
import getRouteClient from "@/lib/supabase/route-client";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    const expires = Number(searchParams.get("expires")) || 3600;

    if (!path) {
      return NextResponse.json(
        { error: "Missing 'path' query param" },
        { status: 400, headers: JSONH },
      );
    }

    const supabase = getRouteClient();
    const { data, error } = await supabase.storage
      .from("requests-photos")
      .createSignedUrl(path, expires);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400, headers: JSONH });

    return NextResponse.json({ url: data.signedUrl, expiresIn: expires }, { status: 200, headers: JSONH });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}
