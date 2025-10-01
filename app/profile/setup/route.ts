import { NextResponse } from "next/server";

export function GET(req: Request) {
  const url = new URL(req.url);
  url.pathname = "/profile/setup";
  return NextResponse.redirect(url, 301);
}

export const dynamic = "force-dynamic";

