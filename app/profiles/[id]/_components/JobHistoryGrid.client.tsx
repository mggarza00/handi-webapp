"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import Lightbox from "./Lightbox.client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type JobItem = { request_id: string; request_title: string; photos: string[] };

export default function JobHistoryGridClient({
  professionalId,
  initial,
  nextCursor,
}: {
  professionalId: string;
  initial: JobItem[];
  nextCursor: string | null;
}) {
  const [items, setItems] = React.useState<JobItem[]>(initial);
  const [cursor, setCursor] = React.useState<string | null>(nextCursor);
  const [loading, setLoading] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<{ url: string; alt: string; list?: string[]; index?: number } | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!lightbox) return;
      if (e.key === "Escape") setLightbox(null);
      if ((e.key === "/" || e.key === "ArrowRight") && lightbox.list && typeof lightbox.index === "number") {
        const next = (lightbox.index + 1) % lightbox.list.length;
        setLightbox({ url: lightbox.list[next]!, alt: lightbox.alt, list: lightbox.list, index: next });
      }
      if ((e.key === "ArrowLeft") && lightbox.list && typeof lightbox.index === "number") {
        const prev = (lightbox.index + lightbox.list.length - 1) % lightbox.list.length;
        setLightbox({ url: lightbox.list[prev]!, alt: lightbox.alt, list: lightbox.list, index: prev });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const loadMore = async () => {
    if (!cursor || loading) return;
    try {
      setLoading(true);
      const url = `/api/professionals/${professionalId}/jobs?limit=10&cursor=${encodeURIComponent(cursor)}`;
      const res = await fetch(url);
      const j = await res.json();
      if (j?.ok) {
        setItems((prev) => [...prev, ...(j.data as JobItem[])]);
        setCursor((j.nextCursor as string | null) ?? null);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Todavía no hay trabajos publicados.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((job) => (
        <Card key={job.request_id} className="shadow-sm">
          <CardHeader className="py-3">
            <CardTitle className="text-base">{job.request_title || "Solicitud"}</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              {job.request_id ? (
                <Link href={`/requests/${job.request_id}`} className="underline">Ver solicitud</Link>
              ) : (
                <button
                  type="button"
                  className="underline"
                  onClick={() => navigator.clipboard.writeText(job.request_id)}
                >
                  Copiar ID
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {job.photos.length ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {job.photos.slice(0, 5).map((src, i) => (
                  <button
                    key={`${job.request_id}-${i}`}
                    type="button"
                    className="group relative h-32 w-full overflow-hidden rounded border md:h-40"
                    onClick={() => setLightbox({ url: src, alt: `Foto del trabajo: ${job.request_title}` , list: job.photos.slice(0, 5), index: i })}
                  >
                    <Image
                      src={src}
                      alt={`Trabajo: ${job.request_title}`}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin fotos.</p>
            )}
          </CardContent>
        </Card>
      ))}

      {cursor ? (
        <div className="flex justify-center">
          <Button onClick={loadMore} disabled={loading} variant="secondary">
            {loading ? "Cargando…" : "Cargar más"}
          </Button>
        </div>
      ) : null}

      <Lightbox
        url={lightbox?.url ?? null}
        alt={lightbox?.alt}
        onOpenChange={(o) => {
          if (!o) setLightbox(null);
        }}
      />
    </div>
  );
}
