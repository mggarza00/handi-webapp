"use client";
import * as React from "react";
import Link from "next/link";

export default function FavoritesPage() {
  const [items, setItems] = React.useState<Array<{ id: string; name: string; avatar_url?: string | null; city?: string | null }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/favorites/pros", { cache: "no-store", credentials: "include" });
        const j = await res.json();
        if (!cancelled) {
          if (!res.ok) throw new Error(j?.error || "No se pudo cargar");
          const data = Array.isArray(j?.data) ? (j.data as Array<{ id: string; name: string; avatar_url?: string | null; city?: string | null }>) : [];
          setItems(data);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Favoritos</h1>
      <p className="mt-1 text-sm text-slate-600">Profesionales que agregaste a tus favoritos.</p>
      {loading ? <p className="mt-4 text-sm text-slate-500">Cargando…</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {!loading && !error && (
        items.length ? (
          <ul className="mt-4 divide-y rounded-lg border bg-white">
            {items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.avatar_url || "/avatar.png"} alt="" className="h-10 w-10 rounded-full border object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">{p.name}</div>
                  <div className="text-xs text-slate-600">{p.city || ""}</div>
                </div>
                <Link href={`/profiles/${p.id}`} className="text-sm text-primary hover:underline">Ver perfil</Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
            Aún no tienes favoritos. Explora profesionales y agrega algunos.
          </div>
        )
      )}
    </main>
  );
}

