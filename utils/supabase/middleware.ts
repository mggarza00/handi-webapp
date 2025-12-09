// utils/supabase/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr/dist/main/types";

// Refresca la sesión (si es necesario) y devuelve un NextResponse
// con las cookies ya aplicadas vía setAll().
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next();
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) return response;

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

    // Tocar auth para forzar refresh cuando sea necesario y producir Set-Cookie
    await supabase.auth.getUser();
  } catch {
    // ser tolerante a fallas (envs, etc.)
  }

  return response;
}

export default updateSession;
