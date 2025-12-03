import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr/dist/main/types";

import updateSession from "@/utils/supabase/middleware";

const ADMIN_ROLES = new Set(["owner", "admin", "ops", "finance", "support", "reviewer"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate-limit only for /api/classify-request (per IP, in-memory)
  if (pathname === "/api/classify-request") {
    try {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon";
      const limit = Number(process.env.CLASSIFY_RATE_PER_MIN || "30");
      const windowMs = 60_000;
      // @ts-ignore reuse bucket across reloads
      const bucket: Map<string, number[]> = (globalThis as any).__rl_classify_bucket__ ||= new Map<string, number[]>();
      const now = Date.now();
      const arr = bucket.get(ip) ?? [];
      const recent = arr.filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        return NextResponse.json(
          { ok: false, error: "RATE_LIMITED", detail: "Too many requests" },
          { status: 429, headers: { "Content-Type": "application/json; charset=utf-8" } },
        );
      }
      recent.push(now);
      bucket.set(ip, recent);
    } catch {
      // ignore RL errors
    }
    return NextResponse.next();
  }
  // Primero refrescamos sesión para mantener cookies al día
  const response = await updateSession(request);
  // Redirección condicional del home a /pro si el usuario está en vista Pro
  if (pathname === "/") {
    try {
      // Consultar perfil SSR para decidir vista
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      if (url && anon) {
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
                const opts = { path: "/", ...(options as CookieOptions) } as CookieSetOptions;
                response.cookies.set(name, value, opts);
              });
            } catch {
              // ignore write errors
            }
          },
        };
        const supabase = createServerClient(url, anon, {
          // ts-expect-error: cookieEncoding 'base64' se alinea con runtime y se castea a 'base64url'
          cookieEncoding: "base64" as unknown as "base64url",
          cookies: cookieMethods,
        });
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          const role = (prof as unknown as { role?: string | null } | null)?.role ?? null;
          if (typeof role === "string" && role.toLowerCase() === "pro") {
            const u = request.nextUrl.clone();
            u.pathname = "/pro";
            return NextResponse.redirect(u);
          }
        }
      }
    } catch {
      // ignore
    }
    return response;
  }

  if (!pathname.startsWith("/admin")) return response;

  // Bypass dev/CI por cookie handi_role
  const allowDev = process.env.NODE_ENV !== "production" || process.env.CI === "true";
  const devRole = (request.cookies.get("handi_role")?.value || "").toLowerCase();
  if (allowDev && devRole && ADMIN_ROLES.has(devRole)) return response;

  // Verifica sesión + perfil vía Supabase (SSR)
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) {
      // Si faltan envs, niega acceso con redirect seguro
      const u = request.nextUrl.clone();
      u.pathname = "/forbidden";
      return NextResponse.redirect(u);
    }

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
            const opts = { path: "/", ...(options as CookieOptions) } as CookieSetOptions;
            response.cookies.set(name, value, opts);
          });
        } catch {
          // ignore write errors
        }
      },
    };
    const supabase = createServerClient(url, anon, {
      // ts-expect-error: cookieEncoding 'base64' se alinea con runtime y se castea a 'base64url'
      cookieEncoding: "base64" as unknown as "base64url",
      cookies: cookieMethods,
    });

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      const u = request.nextUrl.clone();
      u.pathname = "/auth/sign-in";
      u.searchParams.set("next", "/admin");
      return NextResponse.redirect(u);
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .maybeSingle();
    const role = (prof as unknown as { role?: string | null } | null)?.role ?? null;
    const is_admin = (prof as unknown as { is_admin?: boolean | null } | null)?.is_admin === true;
    const seed = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
    const allowedByEmail = seed && user.email && user.email.toLowerCase() === seed;
    if (is_admin || (role && ADMIN_ROLES.has(role.toLowerCase())) || allowedByEmail) {
      return response;
    }
  } catch {
    // En caso de error, negar acceso de forma segura
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
