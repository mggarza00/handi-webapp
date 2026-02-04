"use client";
import * as React from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { normalizeAvatarUrl } from "@/lib/avatar";
// no client-side Supabase update here; upload handled server-side

export function AvatarField({
  url,
  userId,
  onChangeUrl,
}: {
  url?: string;
  userId: string;
  onChangeUrl: (u: string) => void;
}) {
  const [avatarUrl, setAvatarUrl] = React.useState<string>(url || "");
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setAvatarUrl(url || "");
  }, [url]);

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
          const normalized = normalizeAvatarUrl(avatarUrl);
          const src = normalized || avatarUrl || fallbackSvg;
          const isData = typeof src === "string" && src.startsWith("data:");
          return (
            <Image
              src={src}
              alt="Avatar"
              width={64}
              height={64}
              unoptimized={isData}
              className="h-16 w-16 rounded-full object-cover border"
            />
          );
        })()}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          id="avatar-input"
          aria-label="Seleccionar foto de perfil"
          disabled={disabled}
          onChange={async (e) => {
            try {
              const inputEl = e.currentTarget as HTMLInputElement;
              const file = inputEl.files?.[0];
              try {
                inputEl.value = "";
              } catch {
                /* ignore */
              }
              if (!file) return;
              if (!userId) throw new Error("Falta sesión de usuario");
              setBusy(true);
              const fd = new FormData();
              fd.set("file", file);
              const r = await fetch("/api/profile/avatar/upload", {
                method: "POST",
                body: fd,
              });
              const j = await r.json().catch(() => null);
              if (!r.ok || !j?.url)
                throw new Error(j?.detail || "No se pudo subir el avatar");
              setAvatarUrl(j.url);
              onChangeUrl(j.url);
            } catch (err) {
              alert(
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
        Máx 5MB; formatos comunes (JPG, PNG, WEBP).
      </p>
    </div>
  );
}
