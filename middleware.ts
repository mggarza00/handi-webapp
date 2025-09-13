import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  // Canonical host redirect in production
  try {
    if (process.env.VERCEL_ENV === "production") {
      const host = req.headers.get("host") || "";
      const canonical = "handi.mx";
      if (host && host !== canonical) {
        const url = new URL(req.nextUrl);
        url.host = canonical;
        url.protocol = "https:";
        return NextResponse.redirect(url, 308);
      }
    }
  } catch {
    // ignore
  }

  // Redirect legacy /requests to /requests?mine=1
  const { pathname, searchParams, origin } = req.nextUrl;
  if (pathname === "/requests") {
    const mine = (searchParams.get("mine") || "").toLowerCase();
    if (mine !== "1" && mine !== "true") {
      const url = new URL("/requests", origin);
      url.searchParams.set("mine", "1");
      // Preserve other params if any
      for (const [k, v] of searchParams.entries()) {
        if (k !== "mine") url.searchParams.set(k, v);
      }
      return NextResponse.redirect(url);
    }
  }

  // Mantener middleware ligero y compatible con Edge Runtime.
  // La sesión de Supabase se refresca en SSR usando `@supabase/ssr` en rutas/layots.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/|_next/|_vercel|_static/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
