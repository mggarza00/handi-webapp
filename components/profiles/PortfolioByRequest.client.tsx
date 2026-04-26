"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import LightboxGallery from "@/components/profiles/LightboxGallery.client";

const REQUEST_PHOTO_PLACEHOLDER = "/images/Favicon-v1-jpeg.jpg";

export type PortfolioRequestItem = {
  requestId: string;
  title: string;
  photos: string[];
};

type Props = {
  items: PortfolioRequestItem[];
};

export default function PortfolioByRequest({ items }: Props) {
  const groups = useMemo(
    () =>
      items.filter(
        (item) =>
          typeof item.requestId === "string" &&
          item.requestId.trim().length > 0,
      ),
    [items],
  );

  if (!groups.length) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <PortfolioRequestCard key={group.requestId} group={group} />
      ))}
    </div>
  );
}

function PortfolioRequestCard({ group }: { group: PortfolioRequestItem }) {
  const [index, setIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const total = group.photos.length;
  const safeIndex = total > 0 ? Math.min(index, total - 1) : 0;
  const photoUrl =
    total > 0 ? group.photos[safeIndex] : REQUEST_PHOTO_PLACEHOLDER;
  const hasGallery = total > 0;
  const hasMultiplePhotos = total > 1;

  const goPrev = () => setIndex((value) => (value - 1 + total) % total);
  const goNext = () => setIndex((value) => (value + 1) % total);

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-slate-100">
        {hasGallery ? (
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-zoom-in"
            onClick={() => setLightboxIndex(safeIndex)}
            aria-label={`Abrir galería de ${group.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={group.title}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </button>
        ) : (
          <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={REQUEST_PHOTO_PLACEHOLDER}
              alt="Solicitud sin fotos"
              className="h-full w-full object-cover opacity-95"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute bottom-3 left-3 rounded-full bg-white/92 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
              Sin fotos publicadas
            </div>
          </div>
        )}

        {hasMultiplePhotos ? (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/70"
              onClick={goPrev}
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/70"
              onClick={goNext}
              aria-label="Foto siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              {safeIndex + 1} / {total}
            </div>
          </>
        ) : null}
      </div>

      <div className="p-4">
        <p
          className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-5 text-slate-900"
          title={group.title}
        >
          {group.title}
        </p>
      </div>

      {hasGallery ? (
        <LightboxGallery
          photos={group.photos.map((item) => ({
            url: item,
            alt: group.title,
          }))}
          openIndex={lightboxIndex}
          onOpenChange={(open) => {
            if (!open) setLightboxIndex(null);
          }}
        />
      ) : null}
    </article>
  );
}
