"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  address: string;
  city: string | null;
  postal_code: string | null;
  label: string | null;
  lat?: number | null;
  lon?: number | null;
  times_used: number;
  last_used_at: string;
  readOnly?: boolean;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

export default function AddressesList({ initialItems }: { initialItems: Row[] }) {
  const sortItems = (list: Row[]) =>
    [...(list || [])].sort((a, b) => {
      const ta = new Date(a.last_used_at || "").getTime();
      const tb = new Date(b.last_used_at || "").getTime();
      return tb - ta;
    });
  const [items, setItems] = useState<Row[]>(sortItems(initialItems || []));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Row>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const item = items.find((x) => x.id === id);
    if (item?.readOnly) return;
    const confirmText = `¿Seguro que deseas eliminar esta dirección?\n\n${item?.address ?? ""}`;
    if (!confirm(confirmText)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/me/addresses/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      if (!res.ok) throw new Error('DELETE_FAILED');
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {
      // no-op
    } finally {
      setBusy(null);
    }
  }

  function startEdit(r: Row) {
    if (r.readOnly) return;
    setEditingId(r.id);
    setForm({ id: r.id, address: r.address, city: r.city ?? '', postal_code: r.postal_code ?? '', label: r.label ?? '' });
  }

  async function saveEdit() {
    const id = editingId;
    if (!id) return;
    const item = items.find((x) => x.id === id);
    if (item?.readOnly) {
      setEditingId(null);
      setForm({});
      return;
    }
    setBusy(id);
    let ok = false;
    try {
      const payload: Record<string, unknown> = {};
      if (typeof form.address === "string") payload.address = form.address;
      if (typeof form.label === "string") payload.label = form.label;
      const res = await fetch(`/api/me/addresses/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.error || 'PATCH_FAILED');
      const updated = j?.item as Row | undefined;
      const nextRow: Row = {
        ...(items.find((x) => x.id === id) as Row),
        ...(updated ?? {}),
      };
      setItems((prev) =>
        sortItems(prev.map((x) => (x.id === id ? { ...x, ...nextRow } : x))),
      );
      ok = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar la dirección";
      toast({ title: "No se pudo guardar", description: msg });
    } finally {
      setBusy(null);
      if (ok) {
        setEditingId(null);
        setForm({});
      }
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes direcciones guardadas. Se guardarán al crear una solicitud.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-900">Direcciones</div>
        <div />
      </div>
      {items.map((r, idx) => {
        const isDefault = idx === 0;
        return (
        <div key={r.id} className="relative rounded border p-3">
          {editingId === r.id ? (
            <div className="space-y-2">
              <div>
                <label className="text-xs block mb-1">Dirección</label>
                <Input
                  value={String(form.address ?? "")}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs block mb-1">Etiqueta</label>
                <Input
                  value={String(form.label ?? "")}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, label: e.target.value }))
                  }
                  placeholder="Casa, Oficina, etc."
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={saveEdit} disabled={busy === r.id}>Guardar</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm({}); }} disabled={busy === r.id}>Cancelar</Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(r.id)}
                  disabled={busy === r.id}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="text-sm font-medium">{r.address}</div>
              <div className="text-xs text-muted-foreground">
                {r.city ? <span>{r.city}</span> : null}
                {r.postal_code ? <span>{r.city ? " · " : ""}{r.postal_code}</span> : null}
                {r.label ? <span>{(r.city || r.postal_code) ? " · " : ""}{r.label}</span> : null}
                {r.readOnly ? <span>{(r.city || r.postal_code || r.label) ? " · " : ""}Guardada automáticamente</span> : null}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {fmtDate(r.last_used_at)}
                {r.times_used > 0 ? ` · Usada ${r.times_used} vez${r.times_used === 1 ? '' : 'es'}` : ""}
              </div>
              {r.readOnly ? null : (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(r)}
                    disabled={busy === r.id}
                  >
                    Editar
                  </Button>
                </div>
              )}
            </div>
          )}
          {isDefault && editingId !== r.id ? (
            <span className="absolute bottom-2 right-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              Activa
            </span>
          ) : null}
        </div>
      )})}
    </div>
  );
}
