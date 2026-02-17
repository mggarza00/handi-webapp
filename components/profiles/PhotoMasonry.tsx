"use client";
import * as React from "react";

import LightboxGallery from "@/components/profiles/LightboxGallery.client";

export type Photo = {
  url: string;
  requestId?: string;
  title?: string;
  createdAt?: string;
};

export default function PhotoMasonry({ photos }: { photos: Photo[] }) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Galería de trabajos">
      {photos.map((p, i) => (
        <figure key={`${p.url}-${i}`} className="relative overflow-hidden rounded-lg border shadow-sm">
          <div className="relative w-full overflow-hidden bg-slate-100 [aspect-ratio:4/3]">
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group absolute inset-0 h-full w-full cursor-zoom-in"
              aria-label={`Abrir imagen ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.title || "Trabajo realizado"}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-105 group-hover:opacity-90"
                loading="lazy"
                decoding="async"
              />
            </button>
          </div>
          {p.title ? (
            <figcaption className="mt-1 truncate px-1 text-xs text-slate-600" title={p.title}>
              {p.title}
            </figcaption>
          ) : null}
        </figure>
      ))}
      <LightboxGallery
        photos={photos.map((p) => ({ url: p.url, alt: p.title || "Trabajo realizado" }))}
        openIndex={openIndex}
        onOpenChange={(open) => {
          if (!open) setOpenIndex(null);
        }}
      />
    </div>
  );
}
