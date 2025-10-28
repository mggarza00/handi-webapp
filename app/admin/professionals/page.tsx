"use client";
import { useEffect, useMemo, useState } from "react";

import DataTable from "@/components/admin/data-table";
import StateBadge from "@/components/admin/state-badge";
import { Button } from "@/components/ui/button";
//

type Pro = {
  id: string;
  full_name: string;
  city: string | null;
  kyc_status: "pending" | "approved" | "rejected";
  rating: number | null;
  created_at: string;
};

export default function AdminProfessionalsPage() {
  const [items, setItems] = useState<Pro[]>([]);
  const [tab, setTab] = useState<'pending'|'approved'|'observed'|''>('pending');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => { void fetchData(); }, [tab]);
  async function fetchData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab) params.set('kyc', tab);
    const r = await fetch(`/api/admin/professionals?${params.toString()}`, { cache: 'no-store' });
    const j = await r.json();
    setItems(j.items as Pro[]);
    setSelected({});
    setLoading(false);
  }

  async function bulk(status: 'approved'|'rejected'|'needs_info') {
    const ids = Object.entries(selected).filter(([_, v]) => v).map(([id]) => id);
    for (const id of ids) {
      await fetch(`/api/admin/professionals/${id}/kyc`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    }
    await fetchData();
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  const columns = useMemo(() => [
    { accessorFn: (row: Pro) => row.id, id: 'select', header: () => <input type="checkbox" aria-label="Seleccionar todos" onChange={(e) => {
      const v = e.currentTarget.checked; const next: Record<string, boolean> = {}; items.forEach((i) => next[i.id] = v); setSelected(next);
    }} />, cell: ({ row }: { row: { original: Pro } }) => (
      <input type="checkbox" aria-label="Seleccionar" checked={!!selected[row.original.id]} onChange={(e) => setSelected((s) => ({ ...s, [row.original.id]: e.currentTarget.checked }))} />
    ) },
    { accessorKey: 'full_name', header: 'Nombre' },
    { accessorKey: 'city', header: 'Ciudades', cell: (ctx: { getValue: () => unknown }) => (ctx.getValue() as string) || '—' },
    { accessorKey: 'kyc_status', header: 'KYC', cell: (ctx: { getValue: () => unknown }) => <StateBadge value={(ctx.getValue() as string) || ''} /> },
    { accessorKey: 'rating', header: 'Score', cell: (ctx: { getValue: () => unknown }) => (ctx.getValue() as number) ?? '—' },
    { accessorKey: 'created_at', header: 'Registro', cell: (ctx: { getValue: () => unknown }) => new Date(ctx.getValue() as string).toLocaleDateString() },
    { header: 'Acciones', cell: ({ row }: { row: { original: Pro } }) => (
      <div className="flex gap-2 text-sm">
        <button className="text-primary" onClick={() => void fetch(`/api/admin/professionals/${row.original.id}/kyc`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) }).then(fetchData)}>Aprobar</button>
        <button className="text-destructive" onClick={() => void fetch(`/api/admin/professionals/${row.original.id}/kyc`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rejected' }) }).then(fetchData)}>Rechazar</button>
        <button onClick={() => void fetch(`/api/admin/professionals/${row.original.id}/kyc`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'needs_info' }) }).then(fetchData)}>Pedir info</button>
      </div>
    ) },
  ], [items, selected]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className={`rounded-md border px-3 py-1.5 text-sm ${tab === 'pending' ? 'bg-accent' : ''}`} onClick={() => setTab('pending')}>Pendientes</button>
        <button className={`rounded-md border px-3 py-1.5 text-sm ${tab === 'approved' ? 'bg-accent' : ''}`} onClick={() => setTab('approved')}>Aprobados</button>
        <button className={`rounded-md border px-3 py-1.5 text-sm ${tab === 'observed' ? 'bg-accent' : ''}`} onClick={() => setTab('observed')}>Observados</button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => bulk('approved')} disabled={!Object.values(selected).some(Boolean)}>Aprobar</Button>
          <Button variant="outline" size="sm" onClick={() => bulk('rejected')} disabled={!Object.values(selected).some(Boolean)}>Rechazar</Button>
          <Button variant="outline" size="sm" onClick={() => bulk('needs_info')} disabled={!Object.values(selected).some(Boolean)}>Pedir info</Button>
          <a href={`/api/admin/professionals/export${tab ? `?status=${tab}` : ''}`} className="h-9 rounded-md border px-3 text-sm inline-flex items-center">Exportar CSV</a>
        </div>
      </div>
      <DataTable columns={columns} data={items} loading={loading} />
    </div>
  );
}





