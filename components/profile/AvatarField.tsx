"use client";
import * as React from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { normalizeAvatarUrl } from "@/lib/avatar";
// no client-side Supabase update here; upload handled server-side

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export type AvatarFieldChange = {
  displayUrl: string;
  draftPath: string | null;
  previewUrl: string | null;
  // Legacy fallback while old payloads still exist.
  legacyUrl: string | null;
};

export function AvatarField({
  url,
  userId,
  onChangeAvatar,
}: {
  url?: string;
  userId: string;
  onChangeAvatar: (value: AvatarFieldChange) => void;
}) {
  const [avatarUrl, setAvatarUrl] = React.useState<string>(url || "");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [imageFailed, setImageFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const objectUrlRef = React.useRef<string | null>(null);

  const clearObjectPreview = React.useCallback(() => {
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {
        /* ignore */
      }
      objectUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  React.useEffect(() => {
    setAvatarUrl(url || "");
    setImageFailed(false);
  }, [url]);

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        try {
          URL.revokeObjectURL(objectUrlRef.current);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const disabled = !userId || busy;

  const fallbackSvg =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>\n` +
        `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#e5e7eb'/><stop offset='100%' stop-color='#cbd5e1'/></linearGradient></defs>` +
        `<rect width='64' height='64' rx='8' fill='url(#g)'/>` +
        `<circle cx='32' cy='24' r='12' fill='#94a3b8'/>` +
        `<rect x='12' y='40' width='40' height='14' rx='7' fill='#94a3b8'/>` +
        `</svg>`,
    );

  return (
    <div>
      <label className="block text-sm mb-1">Foto de perfil</label>
      <div className="flex items-center gap-3">
        {(() => {
          const remote = normalizeAvatarUrl(avatarUrl) || avatarUrl;
          const src =
            !imageFailed && (previewUrl || remote)
              ? previewUrl || remote
              : fallbackSvg;
          const isUnoptimized =
            typeof src === "string" &&
            (src.startsWith("data:") || src.startsWith("blob:"));
          return (
            <Image
              src={src}
              alt="Avatar"
              width={64}
              height={64}
              unoptimized={isUnoptimized}
              onError={() => setImageFailed(true)}
              className="h-16 w-16 rounded-full object-cover border"
            />
          );
        })()}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          id="avatar-input"
          aria-label="Seleccionar foto de perfil"
          disabled={disabled}
          onChange={async (e) => {
            const prevAvatar = avatarUrl;
            try {
              setError(null);
              setImageFailed(false);
              const inputEl = e.currentTarget as HTMLInputElement;
              const file = inputEl.files?.[0];
              try {
                inputEl.value = "";
              } catch {
                /* ignore */
              }
              if (!file) return;
              if (!userId) throw new Error("Falta sesión de usuario");
              if (!ALLOWED_MIME.has(file.type)) {
                throw new Error("Formato no soportado. Usa JPG, PNG o WEBP.");
              }
              if (file.size > MAX_SIZE) {
                throw new Error("El archivo excede 5MB.");
              }

              clearObjectPreview();
              const localPreview = URL.createObjectURL(file);
              objectUrlRef.current = localPreview;
              setPreviewUrl(localPreview);

              setBusy(true);
              const fd = new FormData();
              fd.set("file", file);
              const r = await fetch("/api/profile/avatar/upload", {
                method: "POST",
                body: fd,
              });
              const j = await r.json().catch(() => null);
              const draftPath =
                typeof j?.draft_path === "string" && j.draft_path.trim()
                  ? j.draft_path.trim()
                  : null;
              const previewFromApi =
                typeof j?.preview_url === "string" && j.preview_url.trim()
                  ? j.preview_url.trim()
                  : null;
              const legacyUrl =
                typeof j?.url === "string" && j.url.trim()
                  ? j.url.trim()
                  : null;
              const nextUrl = previewFromApi || legacyUrl || localPreview;
              if (!r.ok || (!draftPath && !legacyUrl))
                throw new Error(j?.detail || "No se pudo subir el avatar");
              setAvatarUrl(nextUrl);
              onChangeAvatar({
                displayUrl: nextUrl,
                draftPath,
                previewUrl: previewFromApi,
                legacyUrl,
              });

              const resolved = normalizeAvatarUrl(nextUrl) || nextUrl;
              if (resolved) {
                await new Promise<void>((resolve, reject) => {
                  const img = new window.Image();
                  img.onload = () => resolve();
                  img.onerror = () =>
                    reject(new Error("Avatar remoto no disponible"));
                  img.src = resolved;
                }).catch(() => {
                  /* keep local preview if remote isn't ready yet */
                });
              }

              clearObjectPreview();
            } catch (err) {
              setAvatarUrl(prevAvatar);
              clearObjectPreview();
              setError(
                err instanceof Error
                  ? err.message
                  : "Error al actualizar avatar",
              );
            } finally {
              setBusy(false);
            }
          }}
          ref={fileRef}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            try {
              fileRef.current?.click();
            } catch {
              /* ignore */
            }
          }}
        >
          Editar
        </Button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Máx 5MB. Formatos permitidos: JPG, PNG o WEBP.
      </p>
      {error ? (
        <p
          className="mt-1 text-xs text-red-600"
          role="status"
          aria-live="polite"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
