"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type RequestRow = {
  id: string;
  title: string;
  description: string;
  city: string;
  category: string;
  subcategory: string;
  budget: number;
  required_at: string;
  status: string;
};

export default function Jobs() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (city) params.set("city", city);
      const res = await fetch(`/api/requests?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setItems(json.data || []);
    } catch (e: unknown) {
      setErr(
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Error desconocido",
      );
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [q, city]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Trabajos cerca de mi</h2>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          placeholder="Buscar"
          className="rounded-xl border px-3 py-2"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          placeholder="Municipio"
          className="rounded-xl border px-3 py-2"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>

      {loading && <div className="text-sm text-neutral-500">Cargando…</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
      {!loading && items.length === 0 && (
        <div className="text-neutral-500">No hay solicitudes.</div>
      )}

      <div className="space-y-2 text-sm">
        {items.map((r) => (
          <Link
            key={r.id}
            href={`/requests/${r.id}`}
            className="block rounded-xl px-3 py-3 border hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <div className="font-medium">{r.title}</div>
            <div className="text-neutral-500">{r.description}</div>
            <div className="text-xs text-neutral-500 mt-1">
              {r.category} · {r.city} · {r.required_at || "Fecha por definir"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
