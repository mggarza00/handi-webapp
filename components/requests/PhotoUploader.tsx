"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type UploadStatus =
  | "idle"
  | "compressing"
  | "uploading"
  | "saving"
  | "done"
  | "error";

export type UploadedPhoto = {
  id?: string;
  request_id: string;
  path: string;
  thumb_path?: string | null;
  url?: string; // signed
  thumbUrl?: string; // signed
  width?: number;
  height?: number;
  size_bytes?: number;
};

type ItemState = {
  file: File;
  name: string;
  progress: number; // 0..100 (compression + steps)
  status: UploadStatus;
  error?: string;
  result?: UploadedPhoto;
};

export type Props = {
  requestId: string;
  maxFiles?: number; // default 6
  className?: string;
  onComplete?: (items: UploadedPhoto[]) => void;
};

const MAX_AFTER_COMP_BYTES = 10 * 1024 * 1024; // 10MB

const ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

async function readImageSize(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await new Promise((res, rej) => {
      img.onload = () => res(undefined);
      img.onerror = () => rej(new Error("No se pudo leer la imagen"));
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

type HeicConvertFn = (opts: {
  blob: Blob;
  toType: string;
  quality: number;
}) => Promise<Blob>;

async function maybeConvertHeic(file: File): Promise<File> {
  if (file.type === "image/heic" || file.type === "image/heif") {
    try {
      const mod: unknown = await import("heic2any").catch(() => null);
      if (!mod) throw new Error("HEIC no soportado en este navegador");
      let fn: HeicConvertFn | null = null;
      if (typeof mod === "function") fn = mod as HeicConvertFn;
      else if (typeof (mod as Record<string, unknown>).default === "function")
        fn = (mod as Record<string, unknown>).default as HeicConvertFn;
      if (!fn) throw new Error("HEIC no soportado en este navegador");
      const blob = await fn({
        blob: file,
        toType: "image/jpeg",
        quality: 0.95,
      });
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
        type: "image/jpeg",
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "No fue posible convertir HEIC";
      throw new Error(msg);
    }
  }
  return file;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function PhotoUploader({
  requestId,
  maxFiles = 6,
  className,
  onComplete,
}: Props) {
  const [items, setItems] = useState<ItemState[]>([]);
  const busyRef = useRef(false);

  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const handleFiles = useCallback(
    async (filesList: FileList | null) => {
      if (!filesList || filesList.length === 0) return;
      if (busyRef.current) {
        toast("Espera a que terminen las cargas en curso");
        return;
      }

      const selected = Array.from(filesList);
      if (selected.length > maxFiles) {
        toast(
          `Se tomarán solo ${maxFiles} archivos (ignorando ${selected.length - maxFiles}).`,
        );
      }
      const arr = selected.slice(0, maxFiles);
      const initial: ItemState[] = arr.map((f) => ({
        file: f,
        name: f.name,
        progress: 0,
        status: "idle",
      }));
      setItems(initial);
      busyRef.current = true;

      const uploaded: UploadedPhoto[] = [];

      for (let i = 0; i < initial.length; i++) {
        const it = initial[i];
        try {
          setItems((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: "compressing", progress: 5 } : p,
            ),
          );

          // HEIC conversion if needed
          const converted = await maybeConvertHeic(it.file);

          // Compress main
          const mainBlob = await imageCompression(converted, {
            maxWidthOrHeight: 1080,
            initialQuality: 0.8,
            useWebWorker: true,
            fileType: "image/jpeg",
            onProgress: (p) =>
              setItems((prev) =>
                prev.map((p0, idx) =>
                  idx === i
                    ? { ...p0, progress: Math.min(45, Math.max(10, p)) }
                    : p0,
                ),
              ),
          });

          if (mainBlob.size > MAX_AFTER_COMP_BYTES)
            throw new Error("Archivo > 10MB tras compresión");

          // Generate thumbnail
          const thumbBlob = await imageCompression(converted, {
            maxWidthOrHeight: 200,
            initialQuality: 0.7,
            useWebWorker: true,
            fileType: "image/jpeg",
          });

          const { width, height } = await readImageSize(mainBlob);

          // Build unique paths
          const base = `${requestId}/${makeId()}`;
          const mainPath = `${base}.jpg`;
          const thumbPath = `${base}.thumb.jpg`;

          setItems((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: "uploading", progress: 55 } : p,
            ),
          );

          // Upload main
          const { error: upErr1 } = await supabase.storage
            .from("requests-photos")
            .upload(mainPath, mainBlob, {
              contentType: "image/jpeg",
              upsert: false,
            });
          if (upErr1) throw new Error(upErr1.message);

          // Upload thumb
          const { error: upErr2 } = await supabase.storage
            .from("requests-photos")
            .upload(thumbPath, thumbBlob, {
              contentType: "image/jpeg",
              upsert: false,
            });
          if (upErr2) throw new Error(upErr2.message);

          setItems((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: "saving", progress: 80 } : p,
            ),
          );

          // Save metadata and get signed URLs
          const res = await fetch("/api/photos/metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              request_id: requestId,
              path: mainPath,
              thumb_path: thumbPath,
              size_bytes: mainBlob.size,
              width,
              height,
            }),
          });
          const jsonUnknown = await res.json().catch(() => null as unknown);
          if (!res.ok || !jsonUnknown || typeof jsonUnknown !== "object")
            throw new Error("Error al guardar metadatos");
          const j = jsonUnknown as Record<string, unknown>;
          const ok = Boolean(j.ok);
          if (!ok)
            throw new Error(
              (j.error as string) || "Error al guardar metadatos",
            );
          const dataObj = (j.data as Record<string, unknown>) || {};
          const rowObj =
            (dataObj.row as Record<string, unknown> | undefined) || undefined;
          const url = (dataObj.url as string | undefined) || undefined;
          const thumbUrl =
            (dataObj.thumbUrl as string | undefined) || undefined;

          const result: UploadedPhoto = {
            id: rowObj?.id as string | undefined,
            request_id: requestId,
            path: mainPath,
            thumb_path: thumbPath,
            url,
            thumbUrl,
            width,
            height,
            size_bytes: mainBlob.size,
          };

          uploaded.push(result);
          setItems((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: "done", progress: 100, result } : p,
            ),
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Error subiendo la foto";
          setItems((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: "error", error: msg } : p,
            ),
          );
          toast(msg);
        }
      }

      busyRef.current = false;
      if (uploaded.length > 0) {
        toast(`${uploaded.length} foto(s) subidas`);
        onComplete?.(uploaded);
      }
    },
    [maxFiles, onComplete, requestId, supabase],
  );

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          disabled={busyRef.current}
          onChange={(e) => handleFiles(e.target.files)}
          className="block text-sm"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => toast(`Selecciona hasta ${maxFiles} fotos`)}
        >
          Ayuda
        </Button>
      </div>

      <div
        className="mt-3 border border-dashed rounded-md p-6 text-center text-sm text-muted-foreground hover:bg-muted/30"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (busyRef.current)
            return toast("Espera a que terminen las cargas en curso");
          const files = e.dataTransfer?.files || null;
          void handleFiles(files);
        }}
      >
        Arrastra y suelta aquí tus fotos (máx. {maxFiles}).
      </div>

      {items.length > 0 && (
        <div className="mt-4 space-y-3">
          {items.map((it, idx) => (
            <div key={`${it.name}-${idx}`} className="border rounded p-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium truncate max-w-[60%]">
                  {it.name}
                </div>
                <div className="text-xs text-muted-foreground">{it.status}</div>
              </div>
              <div className="mt-2 h-2 w-full bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${it.progress}%` }}
                />
              </div>
              {it.error && (
                <div className="mt-2 text-xs text-red-600">{it.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PhotoUploader;
