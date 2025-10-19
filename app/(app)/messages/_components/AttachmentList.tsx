"use client";

import * as React from "react";

import { useSignedUrls } from "@/app/(app)/messages/_hooks/useSignedUrls";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export type Attachment = {
  id?: string;
  filename: string;
  mime_type: string;
  byte_size?: number | null;
  width?: number | null;
  height?: number | null;
  // storage_path is the key inside the bucket.
  // Example: "conversation/<conversationId>/<folder-or-messageId>/<filename>"
  // Do NOT include the bucket name here.
  storage_path: string;
};

function isImage(mime: string): boolean {
  return /^image\//i.test(mime);
}

function normalizeKey(storagePath: string, bucket: string): string {
  // Accept keys that mistakenly include the bucket name (e.g., "message-attachments/<key>")
  let key = storagePath.replace(/^\/+/, "");
  const prefix = `${bucket}/`;
  if (key.startsWith(prefix)) key = key.slice(prefix.length);
  return key;
}

function humanSize(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"]; let i = 0; let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i < 2 ? 0 : 1)} ${units[i]}`;
}

export function AttachmentList({
  items,
  bucket = "message-attachments",
  signedSeconds = 600, // 10 minutes
  imageMaxWidth = 300,
  className,
  resolveLightboxUrl,
}: {
  items: Attachment[];
  bucket?: string;
  signedSeconds?: number;
  imageMaxWidth?: number;
  className?: string;
  resolveLightboxUrl?: (att: Attachment, signedUrl: string) => string;
}) {
  const keys = React.useMemo(() => (items || []).map((a) => normalizeKey(a.storage_path, bucket)), [items, bucket]);
  const { urls: signed, loading } = useSignedUrls(bucket, keys, { expireSeconds: signedSeconds });
  const [lightbox, setLightbox] = React.useState<{ url: string; alt: string } | null>(null);

  if (!items || items.length === 0) return null;

  return (
    <>
      <div className={className || "flex flex-wrap gap-2"}>
        {(items || []).map((att) => {
          const key = normalizeKey(att.storage_path, bucket);
          const url = signed[key];
          if (!url) return null;
          return (
            <AttachmentPreview
              key={`${att.storage_path}:${att.filename}`}
              url={url}
              att={att}
              imageMaxWidth={imageMaxWidth}
              onOpenLightbox={(u, alt) => {
                const finalUrl = resolveLightboxUrl ? resolveLightboxUrl(att, u) : u;
                setLightbox({ url: finalUrl, alt });
              }}
            />
          );
        })}
        {loading ? <div className="text-xs text-muted-foreground">Cargando adjuntos…</div> : null}
      </div>
      <Dialog open={!!lightbox} onOpenChange={(o) => { if (!o) setLightbox(null); }}>
        <DialogContent className="max-w-3xl p-0 sm:p-0 relative">
          {lightbox?.url ? (
            <>
              <a
                href={lightbox.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-3 top-3 inline-flex items-center rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/70"
                title="Descargar"
              >
                Descargar
              </a>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox.url} alt={lightbox.alt || "Imagen"} className="h-auto w-full rounded object-contain" />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttachmentPreview({ url, att, imageMaxWidth, onOpenLightbox }: { url: string; att: Attachment; imageMaxWidth: number; onOpenLightbox: (url: string, alt: string) => void }) {
  const img = isImage(att.mime_type);
  const size = humanSize(att.byte_size ?? null);
  if (img) {
    return (
      <button
        type="button"
        onClick={() => onOpenLightbox(url, att.filename)}
        className="block overflow-hidden rounded-md border hover:opacity-90"
        title={att.filename}
        aria-label={`Abrir imagen ${att.filename}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={att.filename}
          className="block max-h-56 object-cover"
          style={{ maxWidth: imageMaxWidth }}
        />
      </button>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-accent"
      title={att.filename}
    >
      <span className="inline-block size-6 rounded bg-muted text-center leading-6">📎</span>
      <span className="truncate max-w-[200px]" title={att.filename}>{att.filename}</span>
      {size ? <span className="text-muted-foreground">({size})</span> : null}
    </a>
  );
}
