import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr/dist/main/types";

import updateSession from "@/utils/supabase/middleware";

const ADMIN_ROLES = new Set([
  "owner",
  "admin",
  "ops",
  "finance",
  "support",
  "reviewer",
]);
const MAINTENANCE = process.env.MAINTENANCE_MODE === "true";
const LOG_TIMING = process.env.LOG_TIMING === "1";

function isLocalAdminBypassAllowed(request: NextRequest) {
  // E2E-only admin bypass: requires explicit env, non-production, localhost host.
  if (process.env.E2E_ADMIN_BYPASS !== "1") return false;
  if (process.env.NODE_ENV === "production") return false;
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.hostname ||
    "";
  const hostname = host.split(":")[0].toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function createMiddlewareSupabase(
  request: NextRequest,
  response: NextResponse,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) return null;

  type CookieSetOptions = {
    path?: string;
    domain?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
    httpOnly?: boolean;
    expires?: Date;
    maxAge?: number;
  };

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          const opts = {
            path: "/",
            ...(options as CookieOptions),
          } as CookieSetOptions;
          response.cookies.set(name, value, opts);
        });
      } catch {
        // ignore write errors
      }
    },
  };

  return createServerClient(url, anon, {
    // ts-expect-error: cookieEncoding 'base64' se alinea con runtime y se castea a 'base64url'
    cookieEncoding: "base64" as unknown as "base64url",
    cookies: cookieMethods,
  });
}

export async function middleware(request: NextRequest) {
  const t0 = Date.now();
  const { pathname } = request.nextUrl;

  if (MAINTENANCE) {
    const isAuthPath =
      pathname.startsWith("/auth") || pathname.startsWith("/api/auth");
    const isApiPath = pathname.startsWith("/api");
    if (!isAuthPath && !isApiPath) {
      return new NextResponse("Maintenance", {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  }

  // Rate-limit only for /api/classify-request (per IP, in-memory)
  if (pathname === "/api/classify-request") {
    try {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "anon";
      const limit = Number(process.env.CLASSIFY_RATE_PER_MIN || "30");
      const windowMs = 60_000;
      const globalBucket = globalThis as {
        __rl_classify_bucket__?: Map<string, number[]>;
      };
      const bucket: Map<string, number[]> =
        globalBucket.__rl_classify_bucket__ ??
        (globalBucket.__rl_classify_bucket__ = new Map<string, number[]>());
      const now = Date.now();
      const arr = bucket.get(ip) ?? [];
      const recent = arr.filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        return NextResponse.json(
          { ok: false, error: "RATE_LIMITED", detail: "Too many requests" },
          {
            status: 429,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          },
        );
      }
      recent.push(now);
      bucket.set(ip, recent);
    } catch {
      // ignore RL errors
    }
    return NextResponse.next();
  }
  const hasAuthCookie =
    request.cookies.has("sb-access-token") ||
    request.cookies.has("sb:token") ||
    request.cookies.has("supabase-auth-token");

  if (!hasAuthCookie && !pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Primero refrescamos sesión para mantener cookies al día
  const response = await updateSession(request);
  const supabase = createMiddlewareSupabase(request, response);
  let user: unknown = null;
  let profileRole: string | null = null;
  let profileIsAdmin = false;

  if (supabase) {
    try {
      const { data: auth } = await supabase.auth.getUser();
      user = auth?.user ?? null;
      const userId = (auth?.user as { id?: string } | null)?.id;
      if (userId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role, is_admin")
          .eq("id", userId)
          .maybeSingle();
        profileRole =
          (prof as unknown as { role?: string | null } | null)?.role ?? null;
        profileIsAdmin =
          (prof as unknown as { is_admin?: boolean | null } | null)
            ?.is_admin === true;
      }
    } catch {
      // ignore profile lookup errors
    }
  }

  const requiresRole =
    !!user &&
    (!profileRole || `${profileRole}`.trim() === "") &&
    // Allow /pro-apply without a role to avoid the onboarding loop; pro approval is enforced server-side.
    !pathname.startsWith("/pro-apply") &&
    !pathname.startsWith("/onboarding/elige-rol") &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/auth/sign-out");

  if (requiresRole) {
    const u = request.nextUrl.clone();
    u.pathname = "/onboarding/elige-rol";
    const returnTo = `${pathname}${request.nextUrl.search || ""}`;
    if (returnTo && returnTo !== "/") u.searchParams.set("next", returnTo);
    return NextResponse.redirect(u);
  }
  // RedirecciÃ³n condicional del home a /pro si el usuario estÃ¡ en vista Pro
  if (pathname === "/") {
    const lowered =
      typeof profileRole === "string" ? profileRole.toLowerCase() : null;
    if (lowered === "pro") {
      const u = request.nextUrl.clone();
      u.pathname = "/pro";
      return NextResponse.redirect(u);
    }
    return response;
  }

  if (!pathname.startsWith("/admin")) {
    if (LOG_TIMING) {
      // eslint-disable-next-line no-console
      console.info("[timing] middleware", {
        path: pathname,
        ms: Date.now() - t0,
      });
    }
    return response;
  }

  // Bypass dev/CI por cookie handi_role
  const devRole = (request.cookies.get("handi_role")?.value || "").toLowerCase();
  if (isLocalAdminBypassAllowed(request) && devRole && ADMIN_ROLES.has(devRole))
    return response;

  if (!supabase) {
    const u = request.nextUrl.clone();
    u.pathname = "/forbidden";
    return NextResponse.redirect(u);
  }

  const adminUser = (user as { email?: string | null } | null) ?? null;
  if (!adminUser) {
    const u = request.nextUrl.clone();
    u.pathname = "/auth/sign-in";
    u.searchParams.set("next", "/admin");
    return NextResponse.redirect(u);
  }

  const seed = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const allowedByEmail =
    seed && adminUser.email && adminUser.email.toLowerCase() === seed;
  const canAccessAdmin =
    profileIsAdmin ||
    (profileRole && ADMIN_ROLES.has(profileRole.toLowerCase())) ||
    allowedByEmail;

  if (canAccessAdmin) {
    if (LOG_TIMING) {
      // eslint-disable-next-line no-console
      console.info("[timing] middleware", {
        path: pathname,
        ms: Date.now() - t0,
      });
    }
    return response;
  }

  const u = request.nextUrl.clone();
  u.pathname = "/forbidden";
  return NextResponse.redirect(u);
}

export const config = {
  matcher: [
    "/api/classify-request",
    "/((?!api/|_next/|_vercel|_static/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};

