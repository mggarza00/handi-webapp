"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
  const [items, setItems] = useState<Row[]>(initialItems || []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Row>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const item = items.find((x) => x.id === id);
    if (item?.readOnly) return;
    if (!confirm("¿Eliminar esta dirección?")) return;
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
    try {
      const payload: Record<string, unknown> = {};
      if (typeof form.address === 'string') payload.address = form.address;
      if (typeof form.city === 'string') payload.city = form.city;
      if (typeof form.postal_code === 'string') payload.postal_code = form.postal_code;
      if (typeof form.label === 'string') payload.label = form.label;
      const res = await fetch(`/api/me/addresses/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.error || 'PATCH_FAILED');
      const updated = j?.item as Row;
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...updated } : x)));
      setEditingId(null);
      setForm({});
    } catch {
      // no-op
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No tienes direcciones guardadas. Se guardarán al crear una solicitud.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <div key={r.id} className="rounded border p-3">
          {editingId === r.id ? (
            <div className="space-y-2">
              <div>
                <label className="text-xs block mb-1">Dirección</label>
                <Input value={String(form.address ?? '')} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs block mb-1">Ciudad</label>
                  <Input value={String(form.city ?? '')} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs block mb-1">CP</label>
                  <Input value={String(form.postal_code ?? '')} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1">Etiqueta</label>
                <Input value={String(form.label ?? '')} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={busy === r.id}>Guardar</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm({}); }} disabled={busy === r.id}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div>
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
                  <Button size="sm" variant="outline" onClick={() => startEdit(r)} disabled={busy === r.id}>Editar</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(r.id)} disabled={busy === r.id}>Eliminar</Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
