import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get("host") || "";
  const isProd = process.env.NODE_ENV === "production";
  const canonicalDisabled =
    (process.env.DISABLE_HOST_CANONICAL_REDIRECT || "").trim() === "1";

  if (isProd && !canonicalDisabled) {
    if (host.startsWith("www.")) {
      url.host = host.replace(/^www\./, "");
      url.protocol = "https:";
      return NextResponse.redirect(url, 308);
    }
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return NextResponse.redirect(url, 308);
    }
  }

  const { pathname, searchParams, origin } = req.nextUrl;
  if (pathname === "/requests") {
    const mine = (searchParams.get("mine") || "").toLowerCase();
    if (mine !== "1" && mine !== "true") {
      const redirectUrl = new URL("/requests", origin);
      redirectUrl.searchParams.set("mine", "1");
      for (const [key, value] of searchParams.entries()) {
        if (key !== "mine") redirectUrl.searchParams.set(key, value);
      }
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/|_next/|_vercel|_static/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
