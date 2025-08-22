import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Middleware neutro. Importante: EXCLUYE rutas /api/* y assets.
 * Ajusta aquí tus reglas de protección de páginas (si las necesitas),
 * pero mantén excluidas las APIs de debug/health.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Todas las páginas, excepto:
    // - /api/*
    // - /_next/* y otros assets estáticos
    // - archivos con extensión (favicon.ico, *.png, etc.)
    "/((?!api/|_next/|_vercel|_static/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
