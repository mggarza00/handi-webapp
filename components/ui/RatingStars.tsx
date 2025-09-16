"use client";
import * as React from "react";

export type RatingStarsProps = {
  value?: number | null;
  count?: number | null;
  className?: string;
};

export function RatingStars({ value, count, className }: RatingStarsProps) {
  const v =
    typeof value === "number" ? Math.max(0, Math.min(5, Math.round(value))) : 0;
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-amber-500 " + (className ?? "")
      }
      aria-label={`Calificación ${v} de 5${count ? ` (${count})` : ""}`}
    >
      <span className="leading-none select-none">
        {Array.from({ length: 5 }, (_, i) => (i < v ? "★" : "☆")).join("")}
      </span>
      {typeof count === "number" && (
        <span className="text-xs text-slate-600">({count})</span>
      )}
    </span>
  );
}

export default RatingStars;
