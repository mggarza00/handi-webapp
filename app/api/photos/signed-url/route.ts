import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    const expires = Number(searchParams.get("expires")) || 3600;

    if (!path) {
      return NextResponse.json(
        { error: "Missing 'path' query param" },
        { status: 400 },
      );
    }

    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data, error } = await supabase.storage
      .from("requests-photos")
      .createSignedUrl(path, expires);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ url: data.signedUrl, expiresIn: expires });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
