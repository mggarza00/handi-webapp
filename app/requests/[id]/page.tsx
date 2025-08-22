/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";

type Params = { params: { id: string } };

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export default async function RequestDetailPage({ params }: Params) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/requests/${params.id}`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-store",
  }).catch<unknown>(e => ({ ok: false, error: e }));

  if (typeof res === "object" && res && "ok" in (res as any) && (res as any).ok === false) {
    const msg = getErrorMessage((res as any).error);
    return <div className="p-6">Error: {msg}</div>;
  }

  let json: unknown;
  try {
    // @ts-expect-error: fetch puede haber fallado arriba; protegemos acceso
    json = await res.json();
  } catch (e: unknown) {
    return <div className="p-6">Error: {getErrorMessage(e)}</div>;
  }

  if (typeof json === "object" && json) {
    if ("ok" in json && (json as any).ok === true && "data" in (json as any)) {
      const data = (json as any).data as Record<string, unknown>;
      const title = typeof data.title === "string" ? data.title : "(sin título)";
      const city = typeof data.city === "string" ? data.city : "—";
      return (
        <div className="p-6 space-y-2">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-gray-600">Ciudad: {city}</p>
        </div>
      );
    }
    if ("error" in (json as any)) {
      return <div className="p-6">Error: {getErrorMessage((json as any).error)}</div>;
    }
  }

  return <div className="p-6">Respuesta inesperada del servidor.</div>;
}
