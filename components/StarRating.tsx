"use client";
import * as React from "react";
import { Star } from "lucide-react";

export type StarRatingProps = {
  value?: number | null;
  className?: string;
  size?: number;
  ariaLabel?: string;
};

export default function StarRating({ value, className, size = 14, ariaLabel }: StarRatingProps) {
  const v = typeof value === "number" ? Math.max(0, Math.min(5, value)) : 0;
  const rounded = Math.round(v);
  return (
    <span
      className={(className ?? "") + " inline-flex items-center gap-0.5 text-amber-500"}
      aria-label={ariaLabel ?? `Calificación ${rounded} de 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={i < rounded ? "fill-amber-400 text-amber-400" : "text-amber-400 opacity-40"}
        />
      ))}
    </span>
  );
}

