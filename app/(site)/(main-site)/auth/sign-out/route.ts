import { NextResponse } from "next/server";

import getRouteClient from "@/lib/supabase/route-client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = getRouteClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
