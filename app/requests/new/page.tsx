// app/requests/new/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Breadcrumbs from "@/components/breadcrumbs";
import PageContainer from "@/components/page-container";

type Option = { value: string; label: string };

const CATEGORIES: Record<string, string[]> = {
  "Construcción y Remodelación": ["Albañilería", "Plomería", "Electricidad"],
  "Mantenimiento del Hogar": ["Pintura", "Carpintería", "Yeso y tablaroca"],
  Instalaciones: ["Aire acondicionado", "CCTV", "Cercas y portones"],
};

export default function NewRequestPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Monterrey");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [requiredAt, setRequiredAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const subcatOptions: Option[] = useMemo(() => {
    const list = CATEGORIES[category] ?? [];
    return list.map((s) => ({ value: s, label: s }));
  }, [category]);

  const FormSchema = z.object({
    title: z.string().min(3, "Mínimo 3 caracteres").max(120),
    description: z.string().min(10, "Mínimo 10 caracteres").max(2000).optional().or(z.literal("")),
    city: z.string().min(2, "Ingresa una ciudad válida").max(80),
    category: z.string().min(2).max(80).optional().or(z.literal("")),
    subcategory: z.string().min(1).max(80).optional().or(z.literal("")),
    budget: z
      .union([z.number().positive("Debe ser positivo").max(1_000_000), z.literal("")])
      .optional(),
    required_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD")
      .optional()
      .or(z.literal("")),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    const parsed = FormSchema.safeParse({
      title,
      description,
      city,
      category,
      subcategory,
      budget,
      required_at: requiredAt,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const k = (i.path[0] as string) ?? "form";
        if (!fieldErrors[k]) fieldErrors[k] = i.message;
      });
      setErrors(fieldErrors);
      toast.error("Revisa los campos del formulario");
      setSubmitting(false);
      return;
    }

    // Subir adjuntos (opcional): validación 5MB y MIME imagen
    const attachments: Array<{ url: string; mime: string; size: number }> = [];
    if (files.length > 0) {
      setUploading(true);
      try {
        // Obtener userId para ruta de almacenamiento
        let userId: string | null = null;
        try {
          const meRes = await fetch("/api/me", { headers: { "Content-Type": "application/json; charset=utf-8" } });
          const meJson = await meRes.json();
          userId = meRes.ok ? (meJson?.user?.id as string | undefined) ?? null : null;
        } catch {
          /* unauthenticated: se permite subir como anon */
        }
        const prefix = userId ?? "anon";
        for (const f of files) {
          const max = 5 * 1024 * 1024;
          if (f.size > max) throw new Error(`El archivo ${f.name} excede 5MB`);
          if (!/^image\//i.test(f.type)) throw new Error(`Tipo inválido para ${f.name}`);
          const path = `${prefix}/${Date.now()}-${encodeURIComponent(f.name)}`;
          const up = await supabaseBrowser.storage
            .from("requests")
            .upload(path, f, { contentType: f.type, upsert: false });
          if (up.error) throw new Error(up.error.message);
          const pub = supabaseBrowser.storage.from("requests").getPublicUrl(path);
          const url = pub.data.publicUrl;
          attachments.push({ url, mime: f.type || "image/*", size: f.size });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al subir archivos";
        toast.error(msg);
        setSubmitting(false);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    // Construir payload según el schema del server (RequestCreateSchema)
    const payload: Record<string, unknown> = { title: parsed.data.title, city: parsed.data.city };
    if (parsed.data.description && parsed.data.description.length > 0) payload.description = parsed.data.description.trim();
    if (parsed.data.category && parsed.data.category.length > 0) payload.category = parsed.data.category.trim();
    if (parsed.data.subcategory && parsed.data.subcategory.length > 0)
      payload.subcategories = [parsed.data.subcategory.trim()];
    if (parsed.data.budget !== "" && typeof parsed.data.budget === "number") payload.budget = parsed.data.budget;
    if (parsed.data.required_at && parsed.data.required_at.length > 0) payload.required_at = parsed.data.required_at;
    if (attachments.length > 0) payload.attachments = attachments;

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Create request error", data);
        const detail = data?.detail || data?.error || "No fue posible guardar la solicitud";
        toast.error(detail);
        return;
      }
      toast.success("Solicitud creada");
      // opcional: limpiar formulario
      setTitle("");
      setDescription("");
      setCity("Monterrey");
      setCategory("");
      setSubcategory("");
      setBudget("");
      setRequiredAt("");
      setFiles([]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <div>
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Solicitudes", href: "/requests" }, { label: "Nueva" }]} />
        <h1 className="text-2xl font-bold mt-4 mb-4">Nueva solicitud</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Título</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Necesito plomero"
            required
          />
          {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Descripción</Label>
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe lo que necesitas…"
          />
          {errors.description && <p className="text-xs text-red-600">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Ciudad</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Monterrey"
              required
            />
            {errors.city && <p className="text-xs text-red-600">{errors.city}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Presupuesto (MXN)</Label>
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
              step={100}
              placeholder="1200"
            />
            {errors.budget && <p className="text-xs text-red-600">{errors.budget}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setSubcategory("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(CATEGORIES).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Subcategoría</Label>
            <Select
              value={subcategory}
              onValueChange={setSubcategory}
            >
              <SelectTrigger disabled={!category}>
                <SelectValue placeholder={category ? "Selecciona…" : "Elige una categoría primero"} />
              </SelectTrigger>
              <SelectContent>
                {subcatOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Fecha requerida</Label>
          <Input
            type="date"
            value={requiredAt}
            onChange={(e) => setRequiredAt(e.target.value)}
          />
          {errors.required_at && <p className="text-xs text-red-600">{errors.required_at}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Adjuntos (imágenes, máx 5MB c/u)</Label>
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const list = Array.from(e.currentTarget.files ?? []);
              setFiles(list);
            }}
          />
          {files.length > 0 && (
            <ul className="text-xs text-slate-600 space-y-1">
              {files.map((f) => (
                <li key={f.name} className="flex items-center justify-between">
                  <span>{f.name} · {(f.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button type="submit" disabled={submitting || uploading}>
          {submitting || uploading ? "Publicando…" : "Publicar solicitud"}
        </Button>
      </form>
      </div>
    </PageContainer>
  );
}
