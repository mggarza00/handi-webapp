"use client";
import * as React from "react";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Carousel from "@/components/Carousel";
import StarRating from "@/components/StarRating";

type ReviewItem = {
  id: string;
  client_name: string | null;
  client_avatar: string | null;
  rating: number;
  comment: string | null;
  created_at: string | null;
};

export default function ReviewsCarouselClient({
  professionalId,
  initial,
  nextCursor,
}: {
  professionalId: string;
  initial: ReviewItem[];
  nextCursor: string | null;
}) {
  const [items, setItems] = React.useState<ReviewItem[]>(initial);
  const [cursor, setCursor] = React.useState<string | null>(nextCursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const loadMore = React.useCallback(async () => {
    if (!cursor || loading) return;
    try {
      setLoading(true);
      setError(null);
      const url = `/api/professionals/${professionalId}/reviews?limit=12&cursor=${encodeURIComponent(
        cursor,
      )}`;
      const res = await fetch(url);
      const j = await res.json();
      if (j?.ok) {
        setItems((prev) => [...prev, ...(j.data as ReviewItem[])]);
        setCursor((j.nextCursor as string | null) ?? null);
      } else {
        setError("No se pudo cargar más reseñas.");
      }
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, professionalId]);

  React.useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          loadMore();
        }
      });
    });
    obs.observe(target);
    return () => obs.disconnect();
  }, [loadMore]);

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Aún no hay reseñas.</p>;
  }

  const initials = (name?: string | null) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
  };

  const formatDate = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="relative">
      <Carousel>
        {items.map((r) => (
          <Card key={r.id} className="min-w-[280px] max-w-[320px] snap-start p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarImage src={r.client_avatar ?? undefined} alt={r.client_name ?? "Cliente"} />
                <AvatarFallback>{initials(r.client_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={r.client_name ?? undefined}>
                  {r.client_name ?? "Cliente"}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StarRating value={r.rating} ariaLabel={`Reseña de ${r.client_name ?? "Cliente"} con rating ${r.rating} estrellas`} />
                  {r.created_at ? <span>{formatDate(r.created_at)}</span> : null}
                </div>
              </div>
            </div>
            {r.comment ? (
              <p
                className="mt-2 line-clamp-5 text-sm text-foreground/90"
                title={r.comment}
              >
                {r.comment.length > 300 ? r.comment.slice(0, 300) + "…" : r.comment}
              </p>
            ) : null}
          </Card>
        ))}
        {/* Sentinel */}
        <div ref={sentinelRef} className="min-w-2" />
      </Carousel>
      {error && (
        <div className="mt-2">
          <button
            type="button"
            className="rounded bg-muted px-3 py-1 text-xs"
            onClick={() => loadMore()}
          >
            Reintentar
          </button>
        </div>
      )}
      {loading && (
        <div className="mt-2 flex gap-2">
          <div className="h-20 w-72 animate-pulse rounded-md bg-muted" />
          <div className="h-20 w-72 animate-pulse rounded-md bg-muted" />
        </div>
      )}
    </div>
  );
}
