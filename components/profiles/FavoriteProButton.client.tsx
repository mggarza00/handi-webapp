"use client";
import * as React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FavoriteProButton({ proId }: { proId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load initial favorite status
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/favorites/pros?proId=${encodeURIComponent(proId)}`, { cache: 'no-store', credentials: 'include' });
        const j = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && j && typeof j.is_favorite === 'boolean') setAdded(Boolean(j.is_favorite));
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [proId]);

  async function addFavorite() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/favorites/pros/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify({ proId, favorite: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        const msg = String(j?.error || "No se pudo guardar");
        if (msg.includes("MIGRATION_REQUIRED")) {
          throw new Error("Favoritos aún no está disponible. Por favor aplica las migraciones de base de datos.");
        }
        throw new Error(msg);
      }
      setAdded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function removeFavorite() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/favorites/pros/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify({ proId, favorite: false }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        const msg = String(j?.error || "No se pudo guardar");
        if (msg.includes("MIGRATION_REQUIRED")) {
          throw new Error("Favoritos aún no está disponible. Por favor aplica las migraciones de base de datos.");
        }
        throw new Error(msg);
      }
      setAdded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const onClick = added ? removeFavorite : addFavorite;
  const label = added ? 'Agregado' : 'Agregar a mis favoritos';

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        size="sm"
        onClick={onClick}
        disabled={loading}
        aria-pressed={added}
        variant={added ? "outline" : "default"}
        className={`${added ? "bg-white text-primary border-primary hover:bg-primary/5 hover:text-primary" : ""} gap-1`}
      >
        <Heart className="h-4 w-4" />
        {label}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
