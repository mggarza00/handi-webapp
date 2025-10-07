"use client";
import * as React from "react";

import { Card } from "@/components/ui/card";
import ReviewItem from "@/components/profiles/ReviewItem";

export type ReviewDTO = {
  id: string;
  stars: number;
  comment?: string;
  createdAt: string;
  clientName?: string;
  clientAvatarUrl?: string;
};

export default function ReviewsListClient({ professionalId, initial, nextCursor, total }: { professionalId: string; initial: ReviewDTO[]; nextCursor: string | null; total: number }) {
  const [items, setItems] = React.useState<ReviewDTO[]>(initial);
  const [cursor, setCursor] = React.useState<string | null>(nextCursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/professionals/${professionalId}/reviews?limit=10&cursor=${encodeURIComponent(cursor)}`);
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        const more: ReviewDTO[] = (j.data as any[]).map((r) => ({
          id: String(r.id),
          stars: Number(r.rating ?? 0),
          comment: (r.comment as string | null) || undefined,
          createdAt: (r.created_at as string | null) || "",
          clientName: (r.client_name as string | null) || undefined,
          clientAvatarUrl: (r.client_avatar as string | null) || undefined,
        }));
        setItems((prev) => [...prev, ...more]);
        setCursor((j.nextCursor as string | null) ?? null);
      } else {
        setError("No se pudo cargar más reseñas.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!items.length) return <Card className="p-4 text-sm text-slate-600">Sin reseñas aún.</Card>;

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <ReviewItem key={r.id} stars={r.stars} comment={r.comment} createdAt={r.createdAt} clientName={r.clientName} clientAvatarUrl={r.clientAvatarUrl} />
      ))}
      {(cursor || items.length < total) && (
        <div className="pt-1">
          <button
            type="button"
            onClick={load}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
          >
            {loading ? "Cargando…" : "Ver más reseñas"}
          </button>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      )}
    </div>
  );
}

