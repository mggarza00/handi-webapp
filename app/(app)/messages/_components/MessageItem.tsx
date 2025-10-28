"use client";

import * as React from "react";
// Prefer plain <img> to avoid remote domain config for Next/Image
// eslint-disable-next-line @next/next/no-img-element
import { createSupabaseBrowser } from "@/lib/supabase/client";

export type Attachment = {
  id?: string;
  filename: string;
  mime_type: string;
  byte_size?: number | null;
  width?: number | null;
  height?: number | null;
  storage_path: string; // e.g. conversation/<convId>/<any>/<file>
};

function isImage(mime: string, filename?: string): boolean {
  if (/^image\//i.test(mime)) return true;
  const name = filename || "";
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i.test(name);
}

type MessageItemProps = {
  body: string;
  attachments?: Attachment[];
  createdAt?: string;
  isMine?: boolean;
};

export default function MessageItem({ body, attachments = [], createdAt, isMine = false }: MessageItemProps) {
  const supabase = React.useMemo(() => createSupabaseBrowser(), []);
  const [urls, setUrls] = React.useState<Array<{ key: string; url: string; att: Attachment }>>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!attachments || attachments.length === 0) {
        setUrls([]);
        return;
      }
      setLoading(true);
      try {
        const out: Array<{ key: string; url: string; att: Attachment }> = [];
        for (const att of attachments) {
          try {
            const { data, error } = await supabase.storage
              .from("message-attachments")
              .createSignedUrl(att.storage_path, 60 * 10); // 10 minutes
            if (error || !data?.signedUrl) continue;
            out.push({ key: att.storage_path, url: data.signedUrl, att });
          } catch {
            // ignore individual errors
          }
        }
        if (!cancelled) setUrls(out);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [attachments, supabase]);

  return (
    <div className="flex flex-col gap-2">
      {body && body.trim().length > 0 ? (
        <div className={`rounded-2xl px-3 py-2 text-sm ${isMine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          {body}
        </div>
      ) : null}

      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map(({ key, url, att }) => (
            <AttachmentPreview key={key} url={url} att={att} />
          ))}
          {loading ? <div className="text-xs text-muted-foreground">Cargando adjuntos…</div> : null}
        </div>
      )}

      {createdAt ? (
        <div className="text-[11px] text-muted-foreground">{new Date(createdAt).toLocaleString()}</div>
      ) : null}
    </div>
  );
}

function humanSize(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"]; let i = 0; let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i < 2 ? 0 : 1)} ${units[i]}`;
}

function AttachmentPreview({ url, att }: { url: string; att: Attachment }) {
  const img = isImage(att.mime_type, att.filename);
  const size = humanSize(att.byte_size ?? null);
  if (img) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md border hover:opacity-90"
        title={att.filename}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={att.filename}
          className="block max-h-56 object-cover"
          style={{ maxWidth: 300 }}
        />
      </a>
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
