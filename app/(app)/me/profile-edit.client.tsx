"use client";
import * as React from "react";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const FormSchema = z.object({
  full_name: z.string().min(2).max(120),
  avatar_url: z.string().url().optional().or(z.literal("")),
  headline: z.string().min(2).max(120),
  bio: z.string().min(2).max(2000).optional().or(z.literal("")),
  city: z.string().min(2).max(120),
  years_experience: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 80), "Años inválidos"),
});

export default function ProfileEdit() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const [fullName, setFullName] = React.useState("");
  const [headline, setHeadline] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [city, setCity] = React.useState("");
  const [years, setYears] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me", { headers: { "Content-Type": "application/json; charset=utf-8" }, cache: "no-store" });
        const j = await r.json();
        const meId: string | undefined = j?.user?.id;
        if (!meId) return;
        const rp = await fetch(`/api/users/${meId}`, { headers: { "Content-Type": "application/json; charset=utf-8" }, cache: "no-store" });
        const pj = await rp.json();
        if (!cancelled && rp.ok) {
          const p = pj?.data ?? {};
          setFullName(p?.full_name ?? "");
          setHeadline(p?.headline ?? "");
          setBio(p?.bio ?? "");
          setCity(p?.city ?? "");
          setYears(p?.years_experience != null ? String(p.years_experience) : "");
          setAvatarUrl(p?.avatar_url ?? "");
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
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
      city,
      years_experience: years,
    });
    if (!parsed.success) {
      setError("Revisa los campos del formulario.");
      setLoading(false);
      return;
    }
    try {
      const r = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          full_name: fullName,
          avatar_url: avatarUrl || undefined,
          headline,
          bio: bio || undefined,
          city,
          years_experience: years ? Number(years) : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "No se pudo guardar");
      setOk("Perfil actualizado correctamente.");
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("profile:updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium">Perfil</h2>
      <p className="text-xs text-slate-600">Edita tu información visible para clientes.</p>
      {ok && <p className="mt-2 text-sm text-emerald-700">{ok}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <form onSubmit={onSubmit} className="mt-3 grid grid-cols-1 gap-3">
        <div>
          <label className="block text-sm mb-1">Nombre completo</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" />
        </div>
        <div>
          <label className="block text-sm mb-1">Titular (headline)</label>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Ej. Electricista residencial certificado" />
        </div>
        <div>
          <label className="block text-sm mb-1">Ciudad</label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Monterrey, N.L." />
        </div>
        <div>
          <label className="block text-sm mb-1">Años de experiencia</label>
          <Input value={years} onChange={(e) => setYears(e.target.value)} inputMode="numeric" placeholder="5" />
        </div>
        <div>
          <label className="block text-sm mb-1">Bio</label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Cuéntanos sobre tu experiencia y servicios." />
        </div>
        <div>
          <label className="block text-sm mb-1">Avatar URL</label>
          <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="pt-1">
          <Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar cambios"}</Button>
        </div>
      </form>
    </div>
  );
}

