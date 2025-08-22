// lib/http.ts
import { headers as nextHeaders } from "next/headers";

/**
 * Devuelve la URL base correcta para SSR y Client:
 * - En SSR: toma host y protocolo reales de la request (soporta 3000/3001/3002/3004).
 * - En Client: usa window.location.origin si existe.
 * - Fallback: NEXT_PUBLIC_APP_URL o http://localhost:3000.
 */
export function getBaseUrl() {
  // CLIENT
  if (typeof window !== "undefined") {
    // ej. http://localhost:3002
    return window.location.origin;
  }

  // SERVER (SSR / RSC / Route Handlers)
  const h = nextHeaders();

  // Preferidos en proxies/platforms
  const xfProto = h.get("x-forwarded-proto");
  const xfHost = h.get("x-forwarded-host");

  // Local/Node
  const host = xfHost || h.get("host") || "";
  // Si es localhost o 127.*, asume http (Next dev)
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const proto = isLocal ? "http" : (xfProto || "https");

  if (host) return `${proto}://${host}`;

  // Fallback final (no debería pasar, pero por seguridad)
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

type FetchInit = RequestInit & { noStore?: boolean; forwardCookies?: boolean };

export async function ufetch(path: string, init: FetchInit = {}) {
  const { noStore = true, forwardCookies = true, headers, ...rest } = init;

  // SSR: necesita URL absoluta + reenviar cookies para auth
  if (typeof window === "undefined") {
    const h = nextHeaders();
    const cookie = forwardCookies ? h.get("cookie") ?? "" : "";

    const res = await fetch(`${getBaseUrl()}${path}`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(cookie ? { cookie } : {}),
        ...(headers || {}),
      },
      cache: noStore ? "no-store" : "force-cache",
      ...rest,
    });
    return res;
  }

  // CLIENT: ruta relativa funciona con el puerto actual
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(headers || {}),
    },
    ...rest,
  });
  return res;
}
