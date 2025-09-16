/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { SquarePen, Save, X, Trash2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import PhotoGallery from "@/components/ui/PhotoGallery";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Photo = { url: string; alt?: string | null };
type Attachment = { url?: string; path?: string; mime: string; size: number };

export type RequestDetail = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  city?: string | null;
  category?: string | null;
  subcategory?: string | null;
  budget?: number | null;
  required_at?: string | null; // YYYY-MM-DD
  photos?: Photo[] | null;
  [key: string]: unknown;
};

export default function RequestDetailClient({
  initial,
  startInEdit,
  compactActions,
  hideHeader,
  onSaved,
  onDeleted,
}: {
  initial: RequestDetail;
  startInEdit?: boolean;
  compactActions?: boolean;
  hideHeader?: boolean;
  onSaved?: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(Boolean(startInEdit));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Editable fields
  const [title, setTitle] = React.useState(initial.title ?? "");
  const [description, setDescription] = React.useState(
    initial.description ?? "",
  );
  const [status, setStatus] = React.useState(initial.status ?? "active");
  const [city, setCity] = React.useState(initial.city ?? "");
  const [category, setCategory] = React.useState(initial.category ?? "");
  const [subcategory, setSubcategory] = React.useState(
    initial.subcategory ?? "",
  );
  const [budget, setBudget] = React.useState<string>(
    typeof initial.budget === "number" ? String(initial.budget) : "",
  );
  const [requiredAt, setRequiredAt] = React.useState<string>(
    initial.required_at ?? "",
  );
  const [attachments, setAttachments] = React.useState<Attachment[]>(() => {
    const raw = (initial as Record<string, unknown>)["attachments"] as unknown;
    if (Array.isArray(raw)) {
      return raw
        .map((r) => r as Record<string, unknown>)
        .map((r) => ({
          url: (r.url as string | undefined) ?? undefined,
          path: (r.path as string | undefined) ?? undefined,
          mime: String(r.mime ?? "image/*"),
          size: Number(r.size ?? 0),
        }))
        .slice(0, 5);
    }
    const ph = Array.isArray(initial.photos) ? initial.photos : [];
    return ph
      .slice(0, 5)
      .map((p) => ({ url: p.url, mime: String(p.alt ?? "image/*"), size: 0 }));
  });
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [catOptions, setCatOptions] = React.useState<string[]>([]);
  const [subOptions, setSubOptions] = React.useState<
    Record<string, Array<{ name: string; icon?: string | null }>>
  >({});

  

  // Load categories/subcategories for dropdowns
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/catalog/categories", { cache: "no-store" });
        const j = await res.json();
        if (!res.ok || !j?.ok) return;
        const rows = Array.isArray(j.data) ? (j.data as Array<{ category?: string; subcategory?: string | null; icon?: string | null }>) : [];
        const cats = new Map<string, Map<string, { name: string; icon?: string | null }>>();
        for (const r of rows) {
          const c = String(r.category || "").trim();
          const s = (r.subcategory ? String(r.subcategory) : "").trim();
          const icon = (r.icon ?? null) as string | null;
          if (!c) continue;
          if (!cats.has(c)) cats.set(c, new Map());
          if (s) cats.get(c)!.set(s, { name: s, icon });
        }
        const catList = Array.from(cats.keys()).sort((a, b) => a.localeCompare(b, "es"));
        const subsMap: Record<string, Array<{ name: string; icon?: string | null }>> = {};
        for (const [c, subs] of cats.entries()) {
          subsMap[c] = Array.from(subs.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
        }
        if (!alive) return;
        setCatOptions(catList);
        setSubOptions(subsMap);
      } catch {
        // ignore; leave empty
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Register window listeners for external edit/save/cancel/delete events
  

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("request-edit-change", {
          detail: { id: initial.id, edit },
        }),
      );
    }
  }, [edit, initial.id]);

  const resetEdits = React.useCallback(() => {
    setTitle(initial.title ?? "");
    setDescription(initial.description ?? "");
    setStatus(initial.status ?? "active");
    setCity(initial.city ?? "");
    setCategory(initial.category ?? "");
    setSubcategory(initial.subcategory ?? "");
    setBudget(typeof initial.budget === "number" ? String(initial.budget) : "");
    setRequiredAt(initial.required_at ?? "");
    setError(null);
    const raw = (initial as Record<string, unknown>)["attachments"] as unknown;
    if (Array.isArray(raw)) {
      setAttachments(
        raw
          .map((r) => r as Record<string, unknown>)
          .map((r) => ({
            url: (r.url as string | undefined) ?? undefined,
            path: (r.path as string | undefined) ?? undefined,
            mime: String(r.mime ?? "image/*"),
            size: Number(r.size ?? 0),
          }))
          .slice(0, 5),
      );
    } else {
      const ph = Array.isArray(initial.photos) ? initial.photos : [];
      setAttachments(
        ph
          .slice(0, 5)
          .map((p) => ({ url: p.url, mime: String(p.alt ?? "image/*"), size: 0 })),
      );
    }
  }, [initial]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/me", {
          headers: { "Content-Type": "application/json; charset=utf-8" },
          credentials: "include",
        });
        const j = await res.json();
        if (!alive) return;
        setUserId(res.ok ? (j?.user?.id as string | null) : null);
      } catch {
        if (alive) setUserId(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleSave = React.useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      const body: Record<string, unknown> = {
        title: title || undefined,
        description: description || undefined,
        status: status || undefined,
        city: city || undefined,
        category: category || undefined,
        subcategories: subcategory ? [subcategory] : undefined,
        budget: budget ? Number(budget) : null,
        required_at: requiredAt
          ? new Date(`${requiredAt}T00:00:00.000Z`).toISOString()
          : undefined,
        attachments: attachments.slice(0, 5),
      };
      let res = await fetch(`/api/requests/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (res.status === 405) {
        res = await fetch(`/api/requests/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(body),
          credentials: "include",
        });
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Error ${res.status}`);
      }
      setEdit(false);
      if (onSaved) onSaved();
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [
    title,
    description,
    status,
    city,
    category,
    subcategory,
    budget,
    requiredAt,
    attachments,
    initial.id,
    onSaved,
    router,
  ]);

  // Register window listeners for external edit/save/cancel/delete events
  React.useEffect(() => {
    function onReqEdit(e: Event) {
      try {
        const ce = e as CustomEvent<{ id?: string }>;
        if (ce?.detail?.id && String(ce.detail.id) === String(initial.id)) {
          setEdit(true);
          setTimeout(() => {
            const el = document.getElementById("request-detail-card");
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 0);
        }
      } catch {
        // ignore
      }
    }
    function onReqSave(e: Event) {
      const ce = e as CustomEvent<{ id?: string }>;
      if (ce?.detail?.id && String(ce.detail.id) === String(initial.id)) {
        void handleSave();
      }
    }
    function onReqCancel(e: Event) {
      const ce = e as CustomEvent<{ id?: string }>;
      if (ce?.detail?.id && String(ce.detail.id) === String(initial.id)) {
        resetEdits();
        setEdit(false);
      }
    }
    function onReqDelete(e: Event) {
      const ce = e as CustomEvent<{ id?: string }>;
      if (ce?.detail?.id && String(ce.detail.id) === String(initial.id)) {
        setConfirmOpen(true);
      }
    }
    window.addEventListener("request-edit", onReqEdit as EventListener);
    window.addEventListener("request-save", onReqSave as EventListener);
    window.addEventListener("request-cancel", onReqCancel as EventListener);
    window.addEventListener("request-delete", onReqDelete as EventListener);
    return () => {
      window.removeEventListener("request-edit", onReqEdit as EventListener);
      window.removeEventListener("request-save", onReqSave as EventListener);
      window.removeEventListener("request-cancel", onReqCancel as EventListener);
      window.removeEventListener("request-delete", onReqDelete as EventListener);
    };
  }, [initial.id, handleSave, resetEdits]);

  async function handleDelete() {
    try {
      setDeleting(true);
      setError(null);
      const res = await fetch(`/api/requests/${initial.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Error ${res.status}`);
      }
      setConfirmOpen(false);
      if (onDeleted) onDeleted();
      else window.location.href = "/requests?mine=1";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  const photos = Array.isArray(initial.photos) ? initial.photos : [];

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await fetch("/api/storage/ensure?b=requests", { method: "POST" }).catch(() => undefined);

      const meRes = await fetch("/api/me", { headers: { "Content-Type": "application/json; charset=utf-8" } }).catch(() => null);
      let currentUserId: string | null = null;
      if (meRes) {
        const meJson = await meRes.json().catch(() => ({}));
        currentUserId = meRes.ok ? ((meJson?.user?.id as string | undefined) ?? null) : null;
      }
      const prefix = currentUserId ?? "anon";

      const next: Attachment[] = [...attachments];
      for (const f of Array.from(files)) {
        if (next.length >= 5) break;
        const max = 5 * 1024 * 1024;
        if (f.size > max) throw new Error(`El archivo ${f.name} excede 5MB`);
        if (!/^image\//i.test(f.type)) throw new Error(`Tipo inválido para ${f.name}`);
        const path = `${prefix}/${Date.now()}-${encodeURIComponent(f.name)}`;
        let uploadedUrl: string | null = null;
        try {
          const up = await supabaseBrowser.storage
            .from("requests")
            .upload(path, f, { contentType: f.type, upsert: false });
          if (up.error) throw up.error;
          const pub = supabaseBrowser.storage
            .from("requests")
            .getPublicUrl(path);
          uploadedUrl = pub.data.publicUrl;
        } catch {
          const fd = new FormData();
          fd.append("file", f);
          fd.append("path", path);
          fd.append("bucket", "requests");
          const r = await fetch("/api/storage/upload", { method: "POST", body: fd });
          const j = await r.json();
          if (!r.ok || !j?.ok) throw new Error(j?.error || "upload_failed");
          uploadedUrl = j.url as string;
        }
        next.push({ url: uploadedUrl!, mime: f.type || "image/*", size: f.size, path });
      }
      setAttachments(next.slice(0, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  const createdBy = (initial as Record<string, unknown>)["created_by"] as
    | string
    | null
    | undefined;
  const isOwner = Boolean(userId && createdBy && userId === createdBy);

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold truncate">
            {initial.title ?? "Solicitud"}
          </h1>
          {isOwner ? (
            !edit ? (
              <div className="flex items-center gap-2">
                <Button
                  variant={compactActions ? "ghost" : "outline"}
                  size="sm"
                  onClick={() => setEdit(true)}
                  aria-label="Editar"
                  className={compactActions ? "p-2" : "gap-1"}
                >
                  <SquarePen className="h-4 w-4" />
                  {compactActions ? null : <span>Editar</span>}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  aria-label="Guardar"
                  className={compactActions ? "p-2" : "gap-1"}
                >
                  <Save className="h-4 w-4" />
                  {compactActions ? null : <span>Guardar</span>}
                </Button>
                <Button
                  variant={compactActions ? "ghost" : "ghost"}
                  size="sm"
                  onClick={() => {
                    resetEdits();
                    setEdit(false);
                  }}
                  aria-label="Cancelar"
                  className={compactActions ? "p-2" : "gap-1"}
                >
                  <X className="h-4 w-4" />
                  {compactActions ? null : <span>Cancelar</span>}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                  aria-label="Eliminar"
                  className={compactActions ? "p-2 hidden md:inline-flex" : "gap-1"}
                >
                  <Trash2 className="h-4 w-4" />
                  {compactActions ? null : <span>Eliminar</span>}
                </Button>
              </div>
            )
          ) : null}
        </div>
      )}

      {error ? <Card className="p-3 text-sm text-red-600">{error}</Card> : null}

      <Card id="request-detail-card" className="p-4 space-y-4">
        {!edit ? (
          <div className="space-y-3">
            <Field label="Descripción" value={description} multiline />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Estado" value={status} />
              <Field label="Ciudad" value={city} />
              <Field label="Categoría" value={category} />
              <Field label="Subcategoría" value={subcategory} />
              <Field label="Presupuesto (MXN)" value={budget} />
              <Field label="Fecha requerida" value={requiredAt} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-600">Título</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-600">Descripción</label>
              <Textarea
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-600">Estado</label>
                <Input value={status ?? ""} onChange={(e) => setStatus(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-slate-600">Ciudad</label>
                <Input value={city ?? ""} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-slate-600">Categoría</label>
                <Select
                  value={category || undefined}
                  onValueChange={(v) => {
                    setCategory(v);
                    // reset subcategory if it doesn't belong to selected
                    const allowed = (subOptions[v] || []).map((x) => x.name);
                    if (!allowed.includes(subcategory)) setSubcategory(allowed[0] || "");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {catOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="grow">
                  <label className="text-sm text-slate-600">Subcategoría</label>
                  <Select
                    value={subcategory || undefined}
                    onValueChange={(v) => setSubcategory(v)}
                    disabled={!category}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={category ? "Selecciona subcategoría" : "Selecciona categoría primero"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(subOptions[category] || []).map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        <span className="inline-flex items-center gap-2">
                          {s.icon ? (
                            s.icon.startsWith("http") ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.icon} alt="" className="h-4 w-4 object-contain" />
                            ) : (
                              <span className="text-sm leading-none">{s.icon}</span>
                            )
                          ) : null}
                          <span>{s.name}</span>
                        </span>
                      </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-600">Presupuesto (MXN)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">Fecha requerida</label>
                <Input type="date" value={requiredAt} onChange={(e) => setRequiredAt(e.target.value)} />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <div className="text-sm text-slate-600">Fotos</div>
              <div className="flex flex-wrap gap-3">
                {attachments.map((a, i) => (
                  <div key={(a.path || a.url || "") + i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url || "/images/Favicon-v1-jpeg.jpg"}
                      alt={a.mime}
                      className="h-20 w-20 rounded-md object-cover border"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="absolute -top-2 -right-2 inline-flex items-center justify-center h-6 w-6 rounded-full bg-white border shadow hover:bg-slate-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {attachments.length < 5 && (
                  <label className="inline-flex h-20 w-20 items-center justify-center rounded-md border cursor-pointer hover:bg-slate-50">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => addFiles(e.target.files)}
                    />
                    <Plus className="h-5 w-5 text-slate-500" />
                  </label>
                )}
              </div>
              {uploading && <div className="text-xs text-slate-500">Subiendo imágenes…</div>}
            </div>
          </div>
        )}
      </Card>

      {photos.length > 0 && <PhotoGallery photos={photos} />}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar solicitud</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar esta publicación? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button onClick={handleDelete} disabled={deleting} className="gap-1 bg-black text-white hover:opacity-90">
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value?: string | number | null;
  multiline?: boolean;
}) {
  const v = value == null || value === "" ? "—" : String(value);
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      {multiline ? (
        <p className="text-sm text-slate-700 whitespace-pre-line leading-6">{v}</p>
      ) : (
        <div className="text-sm text-slate-700">{v}</div>
      )}
    </div>
  );
}





