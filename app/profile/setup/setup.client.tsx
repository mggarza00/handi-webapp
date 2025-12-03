"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import CityMultiSelect from "@/components/profile/CityMultiSelect";
import CategoryPicker from "@/components/profile/CategoryPicker";
import { AvatarField } from "@/components/profile/AvatarField";
import { fixMojibake } from "@/lib/text";

const Schema = z.object({
  full_name: z.string().min(3, "Nombre completo inválido"),
  headline: z.string().min(3, "Escribe un titular de al menos 3 caracteres"),
  service_cities: z.array(z.string()).min(1, "Agrega al menos una ciudad"),
  categories: z.array(z.string()).min(1, "Selecciona al menos una categoría"),
  subcategories: z.array(z.string()).optional(),
  years_experience: z.preprocess((v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return 0;
      const n = Number(t);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }, z.number().int().min(0, "Años inválidos").max(80, "Años inválidos")),
  bio: z.string().max(800).optional(),
  // Internal/compat fields (not user-entered directly)
  avatar_url: z.string().url().optional().or(z.literal("")),
  city: z.string().optional(),
});

const sanitizeCityArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((city) => (typeof city === "string" ? fixMojibake(city) : ""))
    .filter((city) => city.length > 0);
};

const getFormString = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

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
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = React.useState(initial?.avatar_url ?? "");
  const sanitizedCities = sanitizeCityArray(initial?.cities ?? null);
  const fallbackCity = typeof initial?.city === "string" && initial.city ? fixMojibake(initial.city) : "";
  const defaultServiceCities =
    sanitizedCities.length > 0 ? sanitizedCities : fallbackCity ? [fallbackCity] : [];
  const [serviceCities, setServiceCities] = React.useState<string[]>(defaultServiceCities);
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
      city: defaultServiceCities[0] || fallbackCity || "",
      service_cities: defaultServiceCities,
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
        const uid = typeof j?.user?.id === "string" ? j.user.id : undefined;
        if (!uid) return;
        if (!cancelled) setMeId(uid);
        const g = await fetch(`/api/profiles/${uid}/gallery`, {
          headers: { "Content-Type": "application/json; charset=utf-8" },
          cache: "no-store",
        });
        const gj = await g.json();
        if (!cancelled && g.ok && Array.isArray(gj?.data)) {
          setGallery(gj.data);
        }
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
    if (!initial?.categories) return [];
    return initial.categories
      .map((item) => fixMojibake(item.name ?? ""))
      .filter((name) => name.length > 0);
  }, [initial]);
  const initialSubcategoryNames = React.useMemo(() => {
    if (!initial?.subcategories) return [];
    return initial.subcategories
      .map((item) => fixMojibake(item.name ?? ""))
      .filter((name) => name.length > 0);
  }, [initial]);

  // Sync controlled UI widgets to RHF state
  React.useEffect(() => {
    form.setValue("service_cities", serviceCities, { shouldValidate: true });
  }, [form, serviceCities]);
  React.useEffect(() => {
    const uniqueCategories = Array.from(new Set(picks.map((p) => p.category).filter(Boolean)));
    const subcats = picks.map((p) => p.subcategory || "").filter(Boolean);
    form.setValue("categories", uniqueCategories, { shouldValidate: true });
    form.setValue("subcategories", subcats, { shouldValidate: false });
  }, [form, picks]);

  async function onSubmit(data: z.input<typeof Schema>) {
    setLoading(true);
    setError(null);
    setOk(null);
    const uniqueCategories = data.categories || [];
    const subcats = data.subcategories || [];
    try {
      const fd = new FormData();
        fd.set("full_name", fixMojibake(data.full_name) || "");
        fd.set("avatar_url", avatarUrl);
        fd.set("headline", fixMojibake(data.headline) || "");
        fd.set("bio", fixMojibake(data.bio || ""));
        fd.set("years_experience", String(data.years_experience ?? ""));
        // Compat: main_city (city) = first of service_cities
        fd.set("city", (data.service_cities?.[0] ?? ""));
        fd.set("service_cities", JSON.stringify(data.service_cities || []));
        fd.set("categories", JSON.stringify(uniqueCategories));
        fd.set("subcategories", JSON.stringify(subcats));
        // Include current private gallery paths for admin approval
        try {
          const paths = (gallery || []).map((g) => g.path).filter(Boolean);
          fd.set("gallery_paths", JSON.stringify(paths));
        } catch {
          /* ignore */
        }
      let ok = false;
      // Prefer server action when available
      if (onRequestChanges) {
        try {
          const r = await onRequestChanges(fd);
          ok = !!r?.ok;
        } catch {
          ok = false;
        }
      }
      // Fallback to API route
      if (!ok) {
        const payload = {
          full_name: getFormString(fd, "full_name"),
          avatar_url: getFormString(fd, "avatar_url"),
          headline: getFormString(fd, "headline"),
          bio: getFormString(fd, "bio"),
          years_experience: Number(fd.get("years_experience") || 0),
          city: getFormString(fd, "city"),
          service_cities: JSON.parse(String(fd.get("service_cities") || "[]")),
          categories: JSON.parse(String(fd.get("categories") || "[]")),
          subcategories: JSON.parse(String(fd.get("subcategories") || "[]")),
          gallery_paths: JSON.parse(String(fd.get("gallery_paths") || "[]")),
        };
        const rr = await fetch("/api/profile/change-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(payload),
        });
        if (!rr.ok) {
          const j = await rr.json().catch(() => null);
          throw new Error(j?.error || "No se pudo enviar la solicitud");
        }
      }
        // Redirige a la pantalla de confirmación
        try {
          router.push("/profile/changes-requested");
          // Fallback duro en caso de que el router falle silenciosamente
          setTimeout(() => {
            try { window.location.assign("/profile/changes-requested"); } catch { /* ignore */ }
          }, 300);
          return;
        } catch {
          // fallback: mostrar mensaje en esta página si la navegación falla
          setOk("Tu solicitud fue enviada a revisión.");
        }
      } catch (e) {
        const msg = e instanceof Error ? (e.message || "Error desconocido") : "Error desconocido";
        if (/NO_CHANGES/i.test(msg)) {
          setError("No hay cambios por enviar. Realiza al menos una modificación antes de solicitar.");
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
  }

  function onInvalid() {
    const e = form.formState.errors;
    const messages: string[] = [];
    if (e.headline?.message) messages.push(String(e.headline.message));
    if (e.service_cities?.message) messages.push(String(e.service_cities.message));
    if (e.categories?.message) messages.push(String(e.categories.message));
    if (e.years_experience?.message) messages.push(String(e.years_experience.message));
    if (e.full_name?.message) messages.push(String(e.full_name.message));
    const msg = messages[0] || "Revisa la información faltante";
    toast.error(msg);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
      {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="block text-sm mb-1" htmlFor="full_name">Nombre completo</label>
        <Input
          id="full_name"
          value={fixMojibake(initial?.full_name) || ""}
          readOnly
          disabled
        />
        <input type="hidden" value={fixMojibake(initial?.full_name) || ""} {...register("full_name")} />
        {errors.full_name && <p className="mt-1 text-xs text-red-600">{String(errors.full_name.message)}</p>}
      </div>

      <div>
        <label className="block text-sm mb-1" htmlFor="headline">Título</label>
        <Input
          id="headline"
          placeholder="Ej. Electricista residencial certificado"
          defaultValue={fixMojibake(initial?.headline) || ""}
          {...register("headline")}
        />
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
        <label className="block text-sm mb-1" htmlFor="bio">Descripción de servicios</label>
        <Textarea
          id="bio"
          rows={4}
          placeholder="Cuéntanos sobre tu experiencia y servicios."
          defaultValue={(fixMojibake(initial?.bio) || "").slice(0, 800)}
          {...register("bio")}
        />
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
          defaultValue={
            typeof initial?.years_experience === "number" && !Number.isNaN(initial.years_experience)
              ? initial.years_experience
              : 0
          }
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
            const inputEl = e.currentTarget as HTMLInputElement;
            const list = Array.from(inputEl.files ?? []);
            if (!meId || list.length === 0) return;
            setUploading(true);
            try {
              for (const f of list) {
                const max = 5 * 1024 * 1024;
                if (f.size > max)
                  throw new Error(`El archivo ${f.name} excede 5MB`);
                if (!/^image\//i.test(f.type))
                  throw new Error(`Tipo inválido para ${f.name}`);
                const fd = new FormData();
                fd.set("file", f);
                const r = await fetch(`/api/profiles/${meId}/gallery`, { method: "POST", body: fd });
                const j = await r.json().catch(() => null);
                if (!r.ok) throw new Error(j?.detail || j?.error || "No se pudo subir imagen");
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
              try {
                inputEl.value = "";
              } catch {
                /* ignore */
              }
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


