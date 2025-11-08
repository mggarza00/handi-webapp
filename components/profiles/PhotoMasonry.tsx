import * as React from "react";

export type Photo = {
  url: string;
  requestId?: string;
  title?: string;
  createdAt?: string;
};

export default function PhotoMasonry({ photos }: { photos: Photo[] }) {
  if (!photos.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Galería de trabajos">
      {photos.map((p, i) => (
        <figure key={`${p.url}-${i}`} className="relative overflow-hidden rounded-lg border shadow-sm">
          <div className="relative w-full overflow-hidden bg-slate-100 [aspect-ratio:4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.title || "Trabajo realizado"}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          {p.title ? (
            <figcaption className="mt-1 truncate px-1 text-xs text-slate-600" title={p.title}>
              {p.title}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
