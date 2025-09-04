import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  try {
    const supabase = createMiddlewareClient({ req, res });
    // Refresca la sesión si es necesario (SSR cookies)
    await supabase.auth.getSession();
  } catch (_) {
    // noop: no bloquear la request si falla el refresco
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!api/|_next/|_vercel|_static/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
