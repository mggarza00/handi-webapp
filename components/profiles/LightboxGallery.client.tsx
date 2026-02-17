"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

type LightboxPhoto = { url: string; alt?: string | null };

export default function LightboxGallery({
  photos,
  openIndex,
  onOpenChange,
}: {
  photos: LightboxPhoto[];
  openIndex: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isOpen = openIndex !== null;
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (typeof openIndex === "number") setIndex(openIndex);
  }, [openIndex]);

  const total = photos.length;
  const current = total > 0 ? photos[(index + total) % total] : null;

  const goPrev = React.useCallback(() => {
    if (!total) return;
    setIndex((prev) => (prev + total - 1) % total);
  }, [total]);

  const goNext = React.useCallback(() => {
    if (!total) return;
    setIndex((prev) => (prev + 1) % total);
  }, [total]);

  React.useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, goPrev, goNext, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-5xl p-0 sm:p-0 border-0 shadow-none bg-transparent"
      >
        {current ? (
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              aria-label="Cerrar"
              className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/70 focus:outline-hidden focus:ring-2 focus:ring-white/70"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </button>

            <button
              type="button"
              aria-label="Anterior"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-hidden focus:ring-2 focus:ring-white/70"
              onClick={goPrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              aria-label="Siguiente"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-hidden focus:ring-2 focus:ring-white/70"
              onClick={goNext}
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.alt ?? "Trabajo realizado"}
              className="max-h-[80vh] w-auto max-w-full rounded object-contain"
            />

            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {index + 1} / {total}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
