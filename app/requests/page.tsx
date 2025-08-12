
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  title?: string;
  description?: string;
  city?: string;
  category?: string;
  subcategory?: string;
  budget?: string | number;
  required_at?: string;
  status?: string;
};

function fmtDate(d?: string) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d ?? "";
  }
}

export default function RequestsPage() {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/requests?limit=50", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (alive) setData(json.data ?? []);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Error al cargar");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Solicitudes activas</h1>

      {loading && <div className="text-neutral-500">Cargando...</div>}
      {error && <div className="text-red-600">Error: {error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="text-left">
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Ciudad</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Subcategoría</th>
                <th className="px-4 py-3">Presupuesto</th>
                <th className="px-4 py-3">Fecha requerida</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium">{r.title || "(sin título)"}</td>
                  <td className="px-4 py-3">{r.city}</td>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3">{r.subcategory}</td>
                  <td className="px-4 py-3">{r.budget ?? ""}</td>
                  <td className="px-4 py-3">{fmtDate(r.required_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/requests/${r.id}`}
                      className="inline-flex items-center rounded-lg px-3 py-1.5 border border-neutral-300 hover:bg-white"
                    >
                      Ver detalles
                    </Link>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-neutral-500 text-center">
                    No hay solicitudes aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
