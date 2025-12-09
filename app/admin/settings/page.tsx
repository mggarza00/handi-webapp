"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  commission_percent: z.coerce.number().min(0).max(100),
  vat_percent: z.coerce.number().min(0).max(100),
});

export default function AdminSettingsPage() {
  const [form, setForm] = useState({ commission_percent: 10, vat_percent: 16 });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error("Datos inválidos");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Configuración guardada");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Comisión (%)</label>
        <Input type="number" step="0.1" min={0} max={100} value={form.commission_percent} onChange={(e) => setForm((f) => ({ ...f, commission_percent: Number(e.target.value) }))} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">IVA (%)</label>
        <Input type="number" step="0.1" min={0} max={100} value={form.vat_percent} onChange={(e) => setForm((f) => ({ ...f, vat_percent: Number(e.target.value) }))} />
      </div>
      <div className="pt-2">
        <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar"}</Button>
      </div>
    </form>
  );
}
