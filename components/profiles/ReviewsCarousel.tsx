"use client";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import RatingStars from "@/components/ui/RatingStars";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
  client_id?: string | null;
  client_name?: string | null;
  client_avatar_url?: string | null;
};

export type ReviewsCarouselProps = {
  reviews?: Review[] | null;
  className?: string;
};

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function TruncatedComment({ text }: { text?: string | null }) {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length <= 300) {
    return <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{trimmed}</p>;
  }
  const short = trimmed.slice(0, 300) + "…";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className="mt-2 text-sm text-slate-700 line-clamp-5 cursor-help" aria-label="Ver comentario completo">
          {short}
        </p>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[90vw] md:max-w-lg leading-5">
        <span className="whitespace-pre-line">{trimmed}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export default function ReviewsCarousel({ reviews, className }: ReviewsCarouselProps) {
  const list = Array.isArray(reviews) ? reviews : [];
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  if (list.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-slate-600">Aún no hay reseñas.</p>
      </div>
    );
  }

  function scrollBy(delta: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }

  return (
    <div className={"relative " + (className ?? "")}
      role="region"
      aria-label="Reseñas de clientes"
    >
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-3 pb-2"
        aria-live="polite"
      >
        {list.map((r) => (
          <Card
            key={r.id}
            className="min-w-[280px] max-w-[320px] snap-start p-4 shadow-sm"
            aria-label="Tarjeta de reseña"
          >
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarImage src={r.client_avatar_url ?? undefined} alt={r.client_name ?? "Cliente"} />
                <AvatarFallback>{initials(r.client_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={r.client_name ?? undefined}>
                  {r.client_name ?? "Cliente"}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <RatingStars value={r.rating} />
                  {r.created_at ? <span>{formatDate(r.created_at)}</span> : null}
                </div>
              </div>
            </div>
            <TruncatedComment text={r.comment ?? null} />
          </Card>
        ))}
      </div>
      {/* Controls */}
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-1">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="pointer-events-auto h-8 w-8 rounded-full shadow"
          aria-label="Desplazar reseñas a la izquierda"
          onClick={() => scrollBy(-320)}
        >
          ‹
        </Button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="pointer-events-auto h-8 w-8 rounded-full shadow"
          aria-label="Desplazar reseñas a la derecha"
          onClick={() => scrollBy(320)}
        >
          ›
        </Button>
      </div>
    </div>
  );
}
