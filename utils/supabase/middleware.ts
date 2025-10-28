// utils/supabase/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Refresca la sesión (si es necesario) y devuelve un NextResponse
// con las cookies ya aplicadas vía setAll().
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next();
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) return response;

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, { ...(options as CookieOptions), path: "/" });
            });
          } catch {
            // ignore write errors
          }
        },
      },
    });

    // Tocar auth para forzar refresh cuando sea necesario y producir Set-Cookie
    await supabase.auth.getUser();
  } catch {
    // ser tolerante a fallas (envs, etc.)
  }

  return response;
}

export default updateSession;
