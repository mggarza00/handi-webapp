"use client";
import * as React from "react";
import { z } from "zod";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CITIES } from "@/lib/cities";
import {
  readDraft,
  writeDraft,
  clearDraft,
  isPendingAutoSubmit,
  clearGatingFlags,
} from "@/lib/drafts";

const AppSchema = z.object({
  full_name: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  email: z.string().email(),
  empresa: z.boolean().optional(),
  services_desc: z.string().min(10).max(1200),
  cities: z.array(z.string().min(2).max(120)).min(1).max(20),
  categories: z.array(z.string().min(2).max(120)).min(1).max(20),
  subcategories: z.array(z.string().min(1).max(120)).max(50).optional(),
  years_experience: z.number().int().min(0).max(80),
  privacy_accept: z.literal(true),
  references: z
    .array(
      z.object({
        name: z.string().min(2).max(120),
        phone: z.string().min(8).max(20),
        relation: z.string().min(2).max(80),
      }),
    )
    .min(1)
    .max(10),
});

type Reference = { name: string; phone: string; relation: string };

export default function ProApplyForm({
  userId,
  userEmail,
  defaultFullName = "",
}: {
  userId: string;
  userEmail: string;
  defaultFullName?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  // Basic fields
  const [fullName, setFullName] = React.useState(defaultFullName || "");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState(userEmail || "");
  const [servicesDesc, setServicesDesc] = React.useState("");
  const [empresa, setEmpresa] = React.useState(false);
  const [selectedCities, setSelectedCities] = React.useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>(
    [],
  );
  const [selectedSubcategories, setSelectedSubcategories] = React.useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = React.useState<
    string[]
  >([]);
  const [groupedSubcats, setGroupedSubcats] = React.useState<Record<string, string[]>>({});
  const [loadingCats, setLoadingCats] = React.useState(false);
  const [years, setYears] = React.useState("");
  const [privacy, setPrivacy] = React.useState(false);

  // Error UI states
  const [fieldErrs, setFieldErrs] = React.useState<Record<string, boolean>>({
    full_name: false,
    phone: false,
    email: false,
    empresa: false,
    services_desc: false,
    cities: false,
    categories: false,
    years_experience: false,
    privacy_accept: false,
  });
  const [refErrs, setRefErrs] = React.useState<
    Array<{ name: boolean; phone: boolean; relation: boolean }>
  >([
    { name: false, phone: false, relation: false },
    { name: false, phone: false, relation: false },
    { name: false, phone: false, relation: false },
  ]);
  const [fileErrs, setFileErrs] = React.useState<{
    cv: boolean;
    letters: boolean;
    idFront: boolean;
    idBack: boolean;
    sig: boolean;
  }>({
    cv: false,
    letters: false,
    idFront: false,
    idBack: false,
    sig: false,
  });

  // Uploads
  const [cvFile, setCvFile] = React.useState<File | null>(null);
  const [letters, setLetters] = React.useState<File[]>([]);
  const [idFront, setIdFront] = React.useState<File | null>(null);
  const [idBack, setIdBack] = React.useState<File | null>(null);

  // References (3 fijas)
  const [refs, setRefs] = React.useState<Reference[]>([
    { name: "", phone: "", relation: "" },
    { name: "", phone: "", relation: "" },
    { name: "", phone: "", relation: "" },
  ]);

  // Signature
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [sigDirty, setSigDirty] = React.useState(false);

  // Load draft on mount
  React.useEffect(() => {
    try {
      const d = readDraft<{
        full_name?: string;
        phone?: string;
        email?: string;
        empresa?: boolean;
        services_desc?: string;
        cities?: string[];
        categories?: string[];
        subcategories?: string[];
        years_experience?: string;
        privacy_accept?: boolean;
        references?: Reference[];
      }>("draft:apply-professional");
      if (d) {
        if (typeof d.full_name === "string") setFullName(d.full_name);
        if (typeof d.phone === "string") setPhone(d.phone);
        if (typeof d.email === "string") setEmail(d.email);
        if (typeof d.empresa === "boolean") setEmpresa(d.empresa);
        if (typeof d.services_desc === "string")
          setServicesDesc(d.services_desc);
        if (Array.isArray(d.cities)) setSelectedCities(d.cities);
        if (Array.isArray(d.categories)) setSelectedCategories(d.categories);
        if (Array.isArray(d.subcategories))
          setSelectedSubcategories(d.subcategories);
        if (typeof d.years_experience === "string")
          setYears(d.years_experience);
        if (typeof d.privacy_accept === "boolean") setPrivacy(d.privacy_accept);
        if (Array.isArray(d.references) && d.references.length === 3)
          setRefs(d.references);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist draft on change (exclude files/signature)
  React.useEffect(() => {
    writeDraft("draft:apply-professional", {
      full_name: fullName,
      phone,
      email,
      empresa,
      services_desc: servicesDesc,
      cities: selectedCities,
      categories: selectedCategories,
      subcategories: selectedSubcategories,
      years_experience: years,
      privacy_accept: privacy,
      references: refs,
    });
  }, [
    fullName,
    phone,
    email,
    empresa,
    servicesDesc,
    selectedCities,
    selectedCategories,
    selectedSubcategories,
    years,
    privacy,
    refs,
  ]);

  // Do not auto-submit this form after login because files/signature cannot be persisted
  React.useEffect(() => {
    if (isPendingAutoSubmit()) {
      // We only rehydrate via the effect above; just clear the gating flags with a gentle note.
      clearGatingFlags();
      toast.message(
        "Tu sesión está iniciada. Revisa los datos, adjunta archivos y envía tu postulación.",
      );
    }
  }, []);

  // Load categories
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCats(true);
      try {
        const res = await fetch("/api/catalog/categories", {
          cache: "no-store",
        });
        const j = await res.json();
        if (!res.ok || j?.ok === false)
          throw new Error(j?.detail || j?.error || "fetch_failed");
        const rows: Array<{ category?: string | null; subcategory?: string | null }> = j?.data ?? [];
        const catSet = new Set<string>();
        const grouped: Record<string, string[]> = {};
        (rows || []).forEach((r) => {
          const c = (r?.category ?? "").toString().trim();
          const s = (r?.subcategory ?? "").toString().trim();
          if (c) catSet.add(c);
          if (c && s) {
            if (!grouped[c]) grouped[c] = [];
            if (!grouped[c].includes(s)) grouped[c].push(s);
          }
        });
        if (!cancelled) {
          setAvailableCategories(Array.from(catSet).sort((a, b) => a.localeCompare(b)));
          // Sort subcategories alphabetically per category
          Object.keys(grouped).forEach((k) => grouped[k].sort((a, b) => a.localeCompare(b)));
          setGroupedSubcats(grouped);
        }
      } catch {
        if (!cancelled) setAvailableCategories([]);
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When categories change, drop any subcategories that no longer belong
  React.useEffect(() => {
    if (!selectedCategories?.length) {
      if (selectedSubcategories.length) setSelectedSubcategories([]);
      return;
    }
    const allowed = new Set<string>();
    selectedCategories.forEach((c) => {
      (groupedSubcats[c] || []).forEach((s) => allowed.add(s));
    });
    const filtered = selectedSubcategories.filter((s) => allowed.has(s));
    if (filtered.length !== selectedSubcategories.length) {
      setSelectedSubcategories(filtered);
    }
  }, [selectedCategories, groupedSubcats, selectedSubcategories]);

  // Signature drawing
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    const rect = () => canvas.getBoundingClientRect();
    const start = (x: number, y: number) => {
      drawing = true;
      lastX = x;
      lastY = y;
      setSigDirty(true);
    };
    const move = (x: number, y: number) => {
      if (!drawing) return;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x;
      lastY = y;
    };
    const end = () => {
      drawing = false;
    };
    const mdown = (e: MouseEvent) =>
      start(e.clientX - rect().left, e.clientY - rect().top);
    const mmove = (e: MouseEvent) =>
      move(e.clientX - rect().left, e.clientY - rect().top);
    const mup = () => end();
    const tstart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      start(t.clientX - rect().left, t.clientY - rect().top);
    };
    const tmove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      move(t.clientX - rect().left, t.clientY - rect().top);
    };
    const tup = () => end();
    canvas.addEventListener("mousedown", mdown);
    canvas.addEventListener("mousemove", mmove);
    window.addEventListener("mouseup", mup);
    const onTouchStart = (e: Event) => tstart(e as TouchEvent);
    canvas.addEventListener("touchstart", onTouchStart as EventListener, {
      passive: true,
    });
    const onTouchMove = (e: Event) => tmove(e as TouchEvent);
    canvas.addEventListener("touchmove", onTouchMove as EventListener, {
      passive: true,
    });
    const onTouchEnd = (_e: Event) => tup();
    window.addEventListener("touchend", onTouchEnd as EventListener);
    return () => {
      canvas.removeEventListener("mousedown", mdown);
      canvas.removeEventListener("mousemove", mmove);
      window.removeEventListener("mouseup", mup);
      canvas.removeEventListener("touchstart", onTouchStart as EventListener);
      canvas.removeEventListener("touchmove", onTouchMove as EventListener);
      window.removeEventListener("touchend", onTouchEnd as EventListener);
    };
  }, []);

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigDirty(false);
  }

  async function uploadViaApi(
    file: File,
    path: string,
    bucket = "pro-verifications",
  ): Promise<{ url: string; path: string }> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("path", path);
    fd.append("bucket", bucket);
    const res = await fetch("/api/storage/upload", {
      method: "POST",
      body: fd,
    });
    const j = await res.json();
    if (!res.ok || !j?.ok)
      throw new Error(j?.error || "No se pudo subir archivo");
    return { url: j.url as string, path: j.path as string };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setFieldErrs({
      full_name: false,
      phone: false,
      email: false,
      services_desc: false,
      cities: false,
      categories: false,
      years_experience: false,
      privacy_accept: false,
    });
    setRefErrs([
      { name: false, phone: false, relation: false },
      { name: false, phone: false, relation: false },
      { name: false, phone: false, relation: false },
    ]);
    setFileErrs({
      cv: false,
      letters: false,
      idFront: false,
      idBack: false,
      sig: false,
    });

    const cities = selectedCities.slice();
    const cat = selectedCategories.slice();
    const refsTrimmed = refs.map((r) => ({
      name: (r.name || "").trim(),
      phone: (r.phone || "").trim(),
      relation: (r.relation || "").trim(),
    }));
    for (let i = 0; i < refsTrimmed.length; i++) {
      const r = refsTrimmed[i];
      const problems: string[] = [];
      if (r.name.length < 2) problems.push("Nombre");
      if (r.phone.length < 8) problems.push("Teléfono");
      if (r.relation.length < 2) problems.push("Relación");
      if (problems.length > 0) {
        const msg = `Referencia ${i + 1}: ${problems.join(", ")} inválido(s) o incompleto(s)`;
        setError(msg);
        toast.error(msg);
        setRefErrs((prev) =>
          prev.map((x, idx) =>
            idx === i
              ? {
                  name: r.name.length < 2,
                  phone: r.phone.length < 8,
                  relation: r.relation.length < 2,
                }
              : x,
          ),
        );
        return;
      }
    }

    const parsed = AppSchema.safeParse({
      full_name: fullName,
      phone,
      email,
      empresa,
      services_desc: servicesDesc,
      cities,
      categories: cat,
  subcategories: selectedSubcategories,
      years_experience: years ? Number(years) : NaN,
      privacy_accept: privacy,
      references: refsTrimmed,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const friendly = (key: string) => {
        switch (key) {
          case "email":
            return "Ingresa un correo válido";
          case "full_name":
            return "Ingresa tu nombre completo";
          case "phone":
            return "Ingresa un teléfono válido (mín. 8 dígitos)";
          case "empresa":
            return "Indica si aplicas como empresa (opcional)";
          case "services_desc":
            return "Describe brevemente tus servicios (mín. 10 caracteres)";
          case "cities":
            return "Selecciona al menos una ciudad";
          case "categories":
            return "Selecciona al menos una categoría";
          case "years_experience":
            return "Ingresa años de experiencia válidos";
          case "privacy_accept":
            return "Debes aceptar el Aviso de Privacidad";
          default:
            return "Revisa este campo";
        }
      };
      const shown = new Set<string>();
      for (const issue of issues) {
        const key = (issue.path?.[0] as string) || "form";
        if (shown.has(key)) continue;
        shown.add(key);
        toast.error(friendly(key));
        setFieldErrs((prev) => ({ ...prev, [key]: true }));
      }
      setError("Revisa los campos del formulario.");
      return;
    }

    if (!cvFile) {
      const msg = "Sube tu CV (PDF o DOC).";
      setError(msg);
      toast.error(msg);
      setFileErrs((p) => ({ ...p, cv: true }));
      return;
    }
    if ((letters?.length ?? 0) < 1) {
      const msg = "Sube al menos una carta de recomendación.";
      setError(msg);
      toast.error(msg);
      setFileErrs((p) => ({ ...p, letters: true }));
      return;
    }
    if (!idFront || !idBack) {
      const msg = "Sube fotos de tu identificación (ambos lados).";
      setError(msg);
      toast.error(msg);
      setFileErrs((p) => ({ ...p, idFront: !idFront, idBack: !idBack }));
      return;
    }
    if (!sigDirty) {
      const msg = "Firma requerida.";
      setError(msg);
      toast.error(msg);
      setFileErrs((p) => ({ ...p, sig: true }));
      return;
    }

    setLoading(true);
    try {
      // 1) Upload files
      const prefix = `${userId}/`;
      const uploads: Record<string, string | string[]> = {};
      const cvUp = await uploadViaApi(
        cvFile,
        `${prefix}cv-${Date.now()}.${(cvFile.name.split(".").pop() || "pdf").toLowerCase()}`,
      );
      uploads.cv_url = cvUp.url;
      const lettersUrls: string[] = [];
      for (const f of letters) {
        const up = await uploadViaApi(
          f,
          `${prefix}letter-${Date.now()}-${encodeURIComponent(f.name)}`,
        );
        lettersUrls.push(up.url);
      }
      uploads.letters_urls = lettersUrls;
      const idFrontUp = await uploadViaApi(
        idFront,
        `${prefix}id-front-${Date.now()}-${encodeURIComponent(idFront.name)}`,
      );
      const idBackUp = await uploadViaApi(
        idBack,
        `${prefix}id-back-${Date.now()}-${encodeURIComponent(idBack.name)}`,
      );
      uploads.id_front_url = idFrontUp.url;
      uploads.id_back_url = idBackUp.url;
      const canvas = canvasRef.current!;
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), "image/png"),
      );
      const sigFile = new File([blob], "signature.png", { type: "image/png" });
      const sigUp = await uploadViaApi(
        sigFile,
        `${prefix}signature-${Date.now()}.png`,
      );
      uploads.signature_url = sigUp.url;

      // 2) Upsert profile and elevate to pro
      const profRes = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          full_name: fullName,
          city: cities[0],
          cities,
          years_experience: years ? Number(years) : undefined,
          categories: cat,
          subcategories: selectedSubcategories,
          bio: servicesDesc,
          empresa,
        }),
      });
      if (!profRes.ok) {
        const j = await profRes.json().catch(() => null);
        throw new Error(j?.error || "No se pudo guardar el perfil");
      }

      // 3) Send application to admins
      const appRes = await fetch("/api/pro-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          email,
          empresa,
          services_desc: servicesDesc,
          cities,
          categories: cat,
          subcategories: selectedSubcategories,
          years_experience: Number(years),
          references: refsTrimmed,
          uploads,
          privacy_accept: true,
        }),
      });
      if (!appRes.ok) {
        const j = await appRes.json().catch(() => null);
        throw new Error(j?.error || "No se pudo enviar la postulación");
      }

      toast.success("¡Postulación enviada!");
      // Mark role as professional (active user type) best-effort and clear draft
      try {
        await fetch("/api/profile/active-user-type", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ to: "profesional" }),
        });
      } catch (_e) {
        void _e;
      }
      clearDraft("draft:apply-professional");
      clearGatingFlags();
      // Redirigir a página de confirmación
      window.location.href = "/pro-apply/submitted";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      toast.error(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {ok && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          {ok}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-pink-300 bg-pink-50 p-3 text-sm text-pink-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">
          Ingresa los datos de tu postulación
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm mb-1">Nombre completo</label>
            <Input
              aria-invalid={fieldErrs.full_name}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Teléfono de contacto</label>
            <Input
              aria-invalid={fieldErrs.phone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10 dígitos"
              inputMode="tel"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Correo</label>
            <Input
              aria-invalid={fieldErrs.email}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="empresa"
              type="checkbox"
              className="mt-0.5"
              checked={empresa}
              onChange={(e) => setEmpresa(e.currentTarget.checked)}
            />
            <label htmlFor="empresa" className="text-sm">
              Me postulo como empresa
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">
              Describe brevemente cuáles son los servicios que ofreces
            </label>
            <Textarea
              aria-invalid={fieldErrs.services_desc}
              rows={4}
              value={servicesDesc}
              onChange={(e) => setServicesDesc(e.target.value)}
              placeholder="Ej. Electricidad residencial, mantenimiento e instalaciones…"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">
              Ciudades donde ofreces tus servicios
            </label>
            <MultiSelect
              placeholder="Selecciona ciudades"
              options={CITIES as unknown as string[]}
              value={selectedCities}
              onChange={setSelectedCities}
              error={fieldErrs.cities}
            />
            {fieldErrs.cities && (
              <p className="text-xs text-pink-600 mt-1">
                Selecciona al menos una ciudad
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">
              Categorías de servicios
            </label>
            <MultiSelect
              placeholder={
                loadingCats ? "Cargando categorías..." : "Selecciona categorías"
              }
              options={availableCategories}
              value={selectedCategories}
              onChange={setSelectedCategories}
              disabled={loadingCats}
              error={fieldErrs.categories}
            />
            {fieldErrs.categories && (
              <p className="text-xs text-pink-600 mt-1">
                Selecciona al menos una categoría
              </p>
            )}
            {selectedCategories.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-slate-700 mb-2">Subcategorías</p>
                <div className="space-y-2">
                  {selectedCategories.map((cat) => {
                    const subs = groupedSubcats[cat] || [];
                    if (subs.length === 0) return null;
                    return (
                      <details key={cat} className="rounded-md border bg-slate-50">
                        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">{cat}</summary>
                        <div className="px-3 pb-3 pt-1">
                          <div className="flex items-center justify-end mb-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const all = new Set<string>(selectedSubcategories);
                                subs.forEach((s) => all.add(s));
                                setSelectedSubcategories(Array.from(all));
                              }}
                            >
                              Seleccionar todas
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {subs.map((s) => {
                              const checked = selectedSubcategories.includes(s);
                              return (
                                <label key={s} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = e.currentTarget.checked
                                        ? Array.from(new Set([...selectedSubcategories, s]))
                                        : selectedSubcategories.filter((x) => x !== s);
                                      setSelectedSubcategories(next);
                                    }}
                                  />
                                  <span>{s}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm mb-1">
              Años de experiencia en el oficio
            </label>
            <Input
              aria-invalid={fieldErrs.years_experience}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              inputMode="numeric"
              placeholder="5"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">Documentos</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm mb-1">Sube tu CV (PDF o DOC)</label>
            <Input
              className={cn(
                fileErrs.cv && "border-pink-500 focus-visible:ring-pink-500/50",
              )}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setCvFile(e.currentTarget.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">
              Cartas de recomendación (al menos una)
            </label>
            <Input
              className={cn(
                fileErrs.letters &&
                  "border-pink-500 focus-visible:ring-pink-500/50",
              )}
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={(e) =>
                setLetters(Array.from(e.currentTarget.files ?? []))
              }
            />
          </div>
          <div>
            <label className="block text-sm mb-1">
              Identificación oficial (frente)
            </label>
            <Input
              className={cn(
                fileErrs.idFront &&
                  "border-pink-500 focus-visible:ring-pink-500/50",
              )}
              type="file"
              accept="image/*"
              onChange={(e) => setIdFront(e.currentTarget.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">
              Identificación oficial (reverso)
            </label>
            <Input
              className={cn(
                fileErrs.idBack &&
                  "border-pink-500 focus-visible:ring-pink-500/50",
              )}
              type="file"
              accept="image/*"
              onChange={(e) => setIdBack(e.currentTarget.files?.[0] ?? null)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">Referencias laborales</h2>
        <p className="text-xs text-slate-600 mb-3">
          Ingresa datos de personas que puedan confirmar tu experiencia (exjefes
          o clientes).
        </p>
        <div className="space-y-3">
          {refs.map((r, idx) => (
            <div key={idx} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input
                  className={cn(
                    refErrs[idx]?.name &&
                      "border-pink-500 focus-visible:ring-pink-500/50",
                  )}
                  placeholder="Nombre"
                  value={r.name}
                  onChange={(e) =>
                    setRefs((arr) =>
                      arr.map((x, i) =>
                        i === idx ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Input
                  className={cn(
                    refErrs[idx]?.phone &&
                      "border-pink-500 focus-visible:ring-pink-500/50",
                  )}
                  placeholder="Teléfono"
                  value={r.phone}
                  onChange={(e) =>
                    setRefs((arr) =>
                      arr.map((x, i) =>
                        i === idx ? { ...x, phone: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Input
                  className={cn(
                    refErrs[idx]?.relation &&
                      "border-pink-500 focus-visible:ring-pink-500/50",
                  )}
                  placeholder="Relación (ej. jefe anterior)"
                  value={r.relation}
                  onChange={(e) =>
                    setRefs((arr) =>
                      arr.map((x, i) =>
                        i === idx ? { ...x, relation: e.target.value } : x,
                      ),
                    )
                  }
                />
              </div>
              {idx < 2 ? <Separator className="my-2" /> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">
          Aviso de privacidad y firma
        </h2>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={privacy}
            onChange={(e) => setPrivacy(e.currentTarget.checked)}
          />
          <span>
            He leído y acepto el{" "}
            <a
              className="underline"
              href="/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Aviso de Privacidad
            </a>{" "}
            y autorizo a Handi a verificar mis datos para validar mi perfil
            profesional.
          </span>
        </label>
        <div className="mt-4">
          <p className="text-sm mb-2">Firma</p>
          <div
            className={cn(
              "rounded-lg border bg-slate-50 p-2",
              fileErrs.sig && "border-pink-500",
            )}
          >
            <canvas
              ref={canvasRef}
              width={640}
              height={180}
              className="w-full touch-none"
            />
          </div>
          <div className="mt-2">
            <Button type="button" variant="outline" onClick={clearSignature}>
              Limpiar firma
            </Button>
          </div>
        </div>
      </section>

      <div className="pt-1">
        <Button type="submit" disabled={loading}>
          {loading ? "Enviando…" : "Enviar postulación"}
        </Button>
      </div>
    </form>
  );
}

function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  error,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}) {
  const label =
    value.length === 0
      ? placeholder || "Selecciona"
      : value.length <= 3
        ? value.join(", ")
        : `${value.length} seleccionadas`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-full justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60",
            error && "border-pink-500 focus-visible:ring-pink-500/50",
          )}
        >
          <span className="truncate block">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3">
        <div className="max-h-64 overflow-auto space-y-2">
          {options.map((opt) => {
            const checked = value.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const v = e.currentTarget.checked
                      ? Array.from(new Set([...value, opt]))
                      : value.filter((x) => x !== opt);
                    onChange(v);
                  }}
                />
                <span>{opt}</span>
              </label>
            );
          })}
          {options.length === 0 && (
            <div className="text-xs text-slate-500">Sin opciones</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
