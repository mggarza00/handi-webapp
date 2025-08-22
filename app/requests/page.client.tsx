"use client";
import * as React from "react";

type Props = { searchParams?: Record<string, string | string[] | undefined> | null };

export default function RequestsClientPage({ searchParams }: Props) {
  const sp = searchParams ?? {};
  const status = typeof sp.status === "string" ? sp.status : Array.isArray(sp.status) ? sp.status[0] : undefined;
  const city = typeof sp.city === "string" ? sp.city : Array.isArray(sp.city) ? sp.city[0] : undefined;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Requests</h1>
      <p className="text-sm text-gray-600">Filtros: status={status ?? "—"}, city={city ?? "—"}</p>
    </div>
  );
}
