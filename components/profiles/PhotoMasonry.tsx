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
    <div
      className="[column-fill:_balance] columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-6 xl:columns-8 2xl:[column-count:24]"
      aria-label="Galería de trabajos"
    >
      {photos.map((p, i) => (
        <figure key={`${p.url}-${i}`} className="mb-3 break-inside-avoid">
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={p.title || `Foto ${i + 1}`}
            className="group block overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="relative w-full overflow-hidden bg-slate-100 [aspect-ratio:4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.title || "Trabajo realizado"}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
              />
            </div>
          </a>
          {p.title ? (
            <figcaption className="mt-1 truncate text-xs text-slate-600" title={p.title}>
              {p.title}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
