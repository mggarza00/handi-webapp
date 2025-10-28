"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase-browser";
import CityMultiSelect from "@/components/profile/CityMultiSelect";
import CategoryPicker from "@/components/profile/CategoryPicker";
import { AvatarField } from "@/components/profile/AvatarField";
import { fixMojibake } from "@/lib/text";

const Schema = z.object({
  full_name: z.string().min(3),
  headline: z.string().min(3),
  service_cities: z.array(z.string()).min(1, "Agrega al menos una ciudad"),
  categories: z.array(z.string()).min(1, "Selecciona al menos una categoría"),
  subcategories: z.array(z.string()).optional(),
  years_experience: z.coerce.number().int().min(0).max(80),
  bio: z.string().max(800).optional(),
  // Internal/compat fields (not user-entered directly)
  avatar_url: z.string().url().optional().or(z.literal("")),
  city: z.string().optional(),
});

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  city: string | null;
  cities?: string[] | null;
  categories?: Array<{ name: string }> | null;
  subcategories?: Array<{ name: string }> | null;
} | null;

export default function SetupForm({ initial, onRequestChanges }: { initial: Profile; onRequestChanges?: (fd: FormData) => Promise<{ ok: boolean; error?: string }> }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = React.useState(initial?.avatar_url ?? "");
  const [serviceCities, setServiceCities] = React.useState<string[]>(
    Array.isArray(initial?.cities)
      ? (initial!.cities as string[]).filter(Boolean)
      : (typeof initial?.city === "string" && initial?.city ? [fixMojibake(initial?.city)] : []),
  );
  const [picks, setPicks] = React.useState<Array<{ category: string; subcategory?: string | null }>>([]);
  const [gallery, setGallery] = React.useState<
    Array<{ url: string; path: string; name: string; size: number | null }>
  >([]);
  const [uploading, setUploading] = React.useState(false);
  const [meId, setMeId] = React.useState<string | null>(null);

  // react-hook-form with zod validation
  const form = useForm<z.input<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      full_name: fixMojibake(initial?.full_name) || "",
      avatar_url: initial?.avatar_url ?? "",
      headline: fixMojibake(initial?.headline) || "",
      bio: (fixMojibake(initial?.bio) || "").slice(0, 800),
      years_experience: (initial?.years_experience as number | null) ?? 0,
      city: (Array.isArray(initial?.cities) && initial?.cities?.[0]) || (initial?.city ?? "") || "",
      service_cities: Array.isArray(initial?.cities)
        ? (initial!.cities as string[]).filter(Boolean)
        : (typeof initial?.city === "string" && initial?.city ? [fixMojibake(initial?.city)] : []),
      categories: [],
      subcategories: [],
    },
  });
  const { register, handleSubmit, formState: { errors } } = form;

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

  // Build initial categories/subcategories arrays from possible CSV or arrays
  const initialCategoryNames = React.useMemo(() => {
    const raw = (initial as any)?.categories ?? null;
    if (Array.isArray(raw)) return raw.map((x: any) => fixMojibake(String(x?.name || ""))).filter(Boolean);
    if (typeof raw === "string") return raw.split(",").map((s) => fixMojibake(s.trim())).filter(Boolean);
    return [] as string[];
  }, [initial]);
  const initialSubcategoryNames = React.useMemo(() => {
    const raw = (initial as any)?.subcategories ?? null;
    if (Array.isArray(raw)) return raw.map((x: any) => fixMojibake(String(x?.name || ""))).filter(Boolean);
    if (typeof raw === "string") return raw.split(",").map((s) => fixMojibake(s.trim())).filter(Boolean);
    return [] as string[];
  }, [initial]);

  // Sync controlled UI widgets to RHF state
  React.useEffect(() => {
    form.setValue("service_cities", serviceCities, { shouldValidate: true });
  }, [serviceCities]);
  React.useEffect(() => {
    const uniqueCategories = Array.from(new Set(picks.map((p) => p.category).filter(Boolean)));
    const subcats = picks.map((p) => p.subcategory || "").filter(Boolean) as string[];
    form.setValue("categories", uniqueCategories, { shouldValidate: true });
    form.setValue("subcategories", subcats, { shouldValidate: false });
  }, [picks]);

  async function onSubmit(data: z.input<typeof Schema>) {
    setLoading(true);
    setError(null);
    setOk(null);
    const uniqueCategories = data.categories || [];
    const subcats = data.subcategories || [];
    const c = uniqueCategories.map((name) => ({ name }));
    const sc = subcats.map((name) => ({ name }));
    try {
            if (onRequestChanges) {
        const fd = new FormData();
        fd.set("full_name", fixMojibake(data.full_name) || "");
        fd.set("avatar_url", avatarUrl);
        fd.set("headline", fixMojibake(data.headline) || "");
        fd.set("bio", fixMojibake(data.bio || ""));
        fd.set("years_experience", String((data as any).years_experience ?? ""));
        // Compat: main_city (city) = first of service_cities
        fd.set("city", (data.service_cities?.[0] ?? ""));
        fd.set("service_cities", JSON.stringify(data.service_cities || []));
        fd.set("categories", JSON.stringify(uniqueCategories));
        fd.set("subcategories", JSON.stringify(subcats));
        const r = await onRequestChanges(fd);
        if (!r?.ok) throw new Error(r?.error || "No se pudo enviar la solicitud");
        setOk("Tu solicitud fue enviada a revisión.");
      } else {
        setOk("Guardado localmente.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="block text-sm mb-1" htmlFor="full_name">Nombre completo</label>
        <Input id="full_name" placeholder="Tu nombre" {...register("full_name")} readOnly disabled />
        {errors.full_name && <p className="mt-1 text-xs text-red-600">{String(errors.full_name.message)}</p>}
      </div>

      <div>
        <label className="block text-sm mb-1" htmlFor="headline">Titular (headline)</label>
        <Input id="headline" placeholder="Ej. Electricista residencial certificado" {...register("headline")} />
        {errors.headline && <p className="mt-1 text-xs text-red-600">{String(errors.headline.message)}</p>}
      </div>

      <AvatarField userId={meId ?? ""} url={avatarUrl} onChangeUrl={setAvatarUrl} />

      <div>
        <label className="block text-sm mb-1">Ciudades en las que ofrece sus servicios</label>
        <CityMultiSelect
          value={(serviceCities || []).join(", ")}
          onChange={(csv) => setServiceCities(csv.split(",").map((s) => s.trim()).filter(Boolean))}
        />
        {errors.service_cities && <p className="mt-1 text-xs text-red-600">{String(errors.service_cities.message)}</p>}
      </div>

      <div>
        <label className="block text-sm mb-1" htmlFor="bio">Bio</label>
        <Textarea id="bio" rows={4} placeholder="Cuéntanos sobre tu experiencia y servicios." {...register("bio")} />
        {errors.bio && <p className="mt-1 text-xs text-red-600">{String(errors.bio.message)}</p>}
      </div>

      <div>
        <label className="block text-sm mb-1" htmlFor="years_experience">Años de experiencia</label>
        <Input
          id="years_experience"
          type="number"
          min={0}
          max={80}
          step={1}
          placeholder="5"
          {...register("years_experience" as const, { valueAsNumber: true })}
        />
        {errors.years_experience && <p className="mt-1 text-xs text-red-600">{String(errors.years_experience.message)}</p>}
      </div>

      <div>
        <label className="block text-sm mb-1">Categorías y subcategorías (usa + para desplegar)</label>
        <CategoryPicker
          value={picks}
          onChange={setPicks}
          initialCategories={initialCategoryNames}
          initialSubcategories={initialSubcategoryNames}
        />
        <p className="mt-1 text-xs text-slate-500">Usa (+) para ver y elegir subcategorías.</p>
        {errors.categories && <p className="mt-1 text-xs text-red-600">{String(errors.categories.message)}</p>}
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
          {loading ? "Enviando…" : "Solicitar cambios"}
        </Button>
        <p className="mt-2 text-xs text-slate-600">Tus cambios serán revisados por el equipo antes de publicarse.</p>
      </div>
    </form>
  );
}
