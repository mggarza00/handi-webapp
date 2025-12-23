"use client";
import * as React from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function Lightbox({ url, alt, onOpenChange }: { url: string | null; alt?: string | null; onOpenChange: (o: boolean) => void; }) {
  const open = Boolean(url);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 sm:p-0">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt ?? "Imagen"} className="h-auto w-full rounded object-contain" />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
