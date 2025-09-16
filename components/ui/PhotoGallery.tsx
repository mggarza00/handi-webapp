"use client";
import * as React from "react";

type Photo = { url: string; alt?: string | null };

export type PhotoGalleryProps = {
  photos?: Photo[] | null;
  className?: string;
};

export function PhotoGallery({ photos, className }: PhotoGalleryProps) {
  const list = Array.isArray(photos)
    ? photos.filter((p): p is Photo => Boolean(p && p.url))
    : [];
  const [active, setActive] = React.useState<number>(0);

  if (list.length === 0) return null;

  const a = Math.max(0, Math.min(active, list.length - 1));

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={list[a].url}
        alt={list[a].alt ?? "Foto"}
        className="w-full aspect-video object-cover rounded-md border"
      />
      {list.length > 1 && (
        <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-2">
          {list.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${p.url}-${i}`}
              src={p.url}
              alt={p.alt ?? `Foto ${i + 1}`}
              onClick={() => setActive(i)}
              className={
                "h-16 w-full object-cover rounded cursor-pointer border " +
                (i === a
                  ? "ring-2 ring-primary"
                  : "opacity-90 hover:opacity-100")
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PhotoGallery;
