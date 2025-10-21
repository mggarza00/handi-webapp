"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { uploadAvatar } from "@/lib/upload";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function AvatarField({ url, userId, onChangeUrl }: { url?: string; userId: string; onChangeUrl: (u: string) => void }) {
  const [avatarUrl, setAvatarUrl] = React.useState<string>(url || "");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setAvatarUrl(url || "");
  }, [url]);

  const disabled = !userId || busy;

  return (
    <div>
      <label className="block text-sm mb-1">Foto de perfil</label>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl || "/images/default-avatar.png"} alt="Avatar" className="h-16 w-16 rounded-full object-cover border" />
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          id="avatar-input"
          aria-label="Seleccionar foto de perfil"
          disabled={disabled}
          onChange={async (e) => {
            try {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              if (!userId) throw new Error("Falta sesión de usuario");
              setBusy(true);
              const { url: nextUrl } = await uploadAvatar(file, userId, supabaseBrowser);
              if (!nextUrl) throw new Error("No se pudo obtener URL del avatar");
              setAvatarUrl(nextUrl);
              onChangeUrl(nextUrl);
              try {
                const up = await supabaseBrowser.from("profiles").update({ avatar_url: nextUrl }).eq("id", userId);
                if (up.error) throw up.error;
              } catch { /* ignore */ }
            } catch (err) {
              alert(err instanceof Error ? err.message : "Error al actualizar avatar");
            } finally {
              setBusy(false);
            }
          }}
        />
        <label htmlFor="avatar-input">
          <Button type="button" variant="outline" disabled={disabled}>Editar</Button>
        </label>
      </div>
      <p className="mt-1 text-xs text-slate-500">Máx 5MB; formatos comunes (JPG, PNG, WEBP).</p>
    </div>
  );
}
