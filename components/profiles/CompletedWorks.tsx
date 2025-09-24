"use client";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export type WorkItem = {
  request_id: string;
  title: string;
  photos: Array<{ id: string; url: string; alt?: string | null }>;
};

export type CompletedWorksProps = {
  items?: WorkItem[] | null;
  className?: string;
};

export default function CompletedWorks({ items, className }: CompletedWorksProps) {
  const list = Array.isArray(items) ? items : [];
  const [lightbox, setLightbox] = React.useState<{ url: string; alt: string } | null>(
    null,
  );

  if (list.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-slate-600">Aún no hay trabajos realizados.</p>
      </div>
    );
  }

  return (
    <div className={"space-y-4 " + (className ?? "")}
      role="region"
      aria-label="Trabajos realizados"
    >
      {list.map((w) => (
        <Card key={w.request_id} className="shadow-sm">
          <CardHeader className="py-3">
            <CardTitle className="text-base">{w.title || "Solicitud"}</CardTitle>
          </CardHeader>
          <CardContent>
            {w.photos.length ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {w.photos.map((ph) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={ph.id}
                    src={ph.url}
                    alt={ph.alt ?? `Foto del trabajo: ${w.title}`}
                    className="h-32 w-full cursor-zoom-in rounded border object-cover md:h-40"
                    onClick={() =>
                      setLightbox({ url: ph.url, alt: ph.alt ?? `Foto del trabajo: ${w.title}` })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Sin fotos.</p>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-0 sm:p-0">
          {lightbox ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.url}
              alt={lightbox.alt}
              className="h-auto w-full rounded object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

