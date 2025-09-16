"use client";
import * as React from "react";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase-browser";

const FormSchema = z.object({
  full_name: z.string().min(2).max(120),
  avatar_url: z.string().url().optional().or(z.literal("")),
  headline: z.string().min(2).max(120),
  bio: z.string().min(2).max(2000).optional().or(z.literal("")),
  years_experience: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 80),
      "Años inválidos",
    ),
  city: z.string().min(2).max(120),
  categories: z.string().optional(), // CSV simple
  subcategories: z.string().optional(), // CSV simple
});

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  city: string | null;
  categories?: Array<{ name: string }> | null;
  subcategories?: Array<{ name: string }> | null;
} | null;

export default function SetupForm({ initial }: { initial: Profile }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const [fullName, setFullName] = React.useState(initial?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(initial?.avatar_url ?? "");
  const [headline, setHeadline] = React.useState(initial?.headline ?? "");
  const [bio, setBio] = React.useState(initial?.bio ?? "");
  const [years, setYears] = React.useState(
    initial?.years_experience?.toString() ?? "",
  );
  const [city, setCity] = React.useState(initial?.city ?? "");
  const [categories, setCategories] = React.useState(
    (initial?.categories ?? [])
      ?.map((x) => x?.name)
      .filter(Boolean)
      .join(", "),
  );
  const [subcategories, setSubcategories] = React.useState(
    (initial?.subcategories ?? [])
      ?.map((x) => x?.name)
      .filter(Boolean)
      .join(", "),
  );
  const [gallery, setGallery] = React.useState<
    Array<{ url: string; path: string; name: string; size: number | null }>
  >([]);
  const [uploading, setUploading] = React.useState(false);
  const [meId, setMeId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me", {
          headers: { "Content-Type": "application/json; charset=utf-8" },
          cache: "no-store",
        });
        const j = await r.json();
        const uid = j?.user?.id as string | undefined;
        if (!uid) return;
        if (!cancelled) setMeId(uid);
        const g = await fetch(`/api/profiles/${uid}/gallery`, {
          headers: { "Content-Type": "application/json; charset=utf-8" },
          cache: "no-store",
        });
        const gj = await g.json();
        if (!cancelled && g.ok && gj?.data) setGallery(gj.data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(null);
    const parsed = FormSchema.safeParse({
      full_name: fullName,
      avatar_url: avatarUrl,
      headline,
      bio,
      years_experience: years,
      city,
      categories,
      subcategories,
    });
    if (!parsed.success) {
      setError("Revisa los campos del formulario.");
      setLoading(false);
      return;
    }
    const c = (categories || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    const sc = (subcategories || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    try {
      const res = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          full_name: fullName,
          avatar_url: avatarUrl || undefined,
          headline,
          bio: bio || undefined,
          years_experience: years ? Number(years) : undefined,
          city,
          categories: c,
          subcategories: sc,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No se pudo guardar");
      setOk("Tu perfil se guardó correctamente.");
      // Emitir evento para que otras vistas refresquen, si aplica
      window.dispatchEvent(new CustomEvent("profile:updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="block text-sm mb-1">Nombre completo</label>
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Tu nombre"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Titular (headline)</label>
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Ej. Electricista residencial certificado"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Ciudad principal</label>
        <Input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Monterrey, N.L."
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Años de experiencia</label>
        <Input
          value={years}
          onChange={(e) => setYears(e.target.value)}
          placeholder="5"
          inputMode="numeric"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">
          Categorías (separadas por coma)
        </label>
        <Input
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
          placeholder="Electricidad, Plomería"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">
          Subcategorías (separadas por coma)
        </label>
        <Input
          value={subcategories}
          onChange={(e) => setSubcategories(e.target.value)}
          placeholder="Instalación, Mantenimiento"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Bio</label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          placeholder="Cuéntanos sobre tu experiencia y servicios."
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Avatar URL (opcional)</label>
        <Input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-1">Galería profesional</h3>
        <p className="text-xs text-slate-600 mb-2">
          Sube imágenes de tus trabajos (máx 5MB c/u). Se mostrarán en tu perfil
          público.
        </p>
        <Input
          type="file"
          accept="image/*"
          multiple
          onChange={async (e) => {
            const list = Array.from(e.currentTarget.files ?? []);
            if (!meId || list.length === 0) return;
            setUploading(true);
            try {
              for (const f of list) {
                const max = 5 * 1024 * 1024;
                if (f.size > max)
                  throw new Error(`El archivo ${f.name} excede 5MB`);
                if (!/^image\//i.test(f.type))
                  throw new Error(`Tipo inválido para ${f.name}`);
                const path = `${meId}/${Date.now()}-${encodeURIComponent(f.name)}`;
                const up = await supabaseBrowser.storage
                  .from("profiles-gallery")
                  .upload(path, f, { contentType: f.type, upsert: false });
                if (up.error) throw new Error(up.error.message);
              }
              const g = await fetch(`/api/profiles/${meId}/gallery`, {
                headers: { "Content-Type": "application/json; charset=utf-8" },
              });
              const gj = await g.json();
              if (g.ok) setGallery(gj.data ?? []);
            } catch (err) {
              alert(
                err instanceof Error ? err.message : "Error al subir imágenes",
              );
            } finally {
              setUploading(false);
              e.currentTarget.value = "";
            }
          }}
        />
        {gallery.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
            {gallery.map((g) => (
              <li key={g.path} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.url}
                  alt={g.name}
                  className="w-full h-32 object-cover rounded border"
                />
                <button
                  type="button"
                  className="absolute top-2 right-2 text-xs rounded px-2 py-1 bg-white/90 border opacity-0 group-hover:opacity-100"
                  disabled={uploading || !meId}
                  onClick={async () => {
                    if (!meId) return;
                    const del = await fetch(
                      `/api/profiles/${meId}/gallery?path=${encodeURIComponent(g.path)}`,
                      {
                        method: "DELETE",
                        headers: {
                          "Content-Type": "application/json; charset=utf-8",
                        },
                      },
                    );
                    if (del.ok)
                      setGallery((prev) =>
                        prev.filter((x) => x.path !== g.path),
                      );
                  }}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando…" : "Guardar perfil"}
        </Button>
      </div>
    </form>
  );
}
