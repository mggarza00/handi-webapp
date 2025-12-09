"use client";
import { useEffect, useMemo, useState } from "react";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";

import StateBadge from "@/components/admin/state-badge";
import DataTable from "@/components/admin/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DateRangePicker from "@/components/admin/date-range-picker";

type Item = {
  id: string;
  folio: number;
  customer_name: string;
  city: string;
  category: string;
  subcategory: string | null;
  budget: number | null;
  status: "active" | "in_process" | "completed" | "cancelled";
  created_at: string;
};

export default function AdminRequestsPage() {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchData(); }, [page, pageSize, sorting]);

  async function fetchData() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (status) params.set("status", status);
    if (city) params.set("city", city);
    if (category) params.set("category", category);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (minBudget) params.set("minBudget", minBudget);
    if (maxBudget) params.set("maxBudget", maxBudget);
    const sort = sorting[0];
    if (sort?.id) {
      params.set("sortBy", String(sort.id));
      params.set("sortDir", sort.desc ? "desc" : "asc");
    }
    const res = await fetch(`/api/admin/requests?${params.toString()}`, { cache: "no-store" });
    const j = await res.json();
    setData(j.items as Item[]);
    setTotal(j.total as number);
    setLoading(false);
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  const cols = useMemo<ColumnDef<Item>[]>(() => [
    { accessorKey: "folio", header: "Folio", cell: (ctx) => <span className="tabular-nums">{ctx.getValue() as number}</span> },
    { accessorKey: "customer_name", header: "Cliente" },
    { accessorKey: "city", header: "Ciudad" },
    { accessorKey: "category", header: "Categoría" },
    { accessorKey: "budget", header: "Presupuesto", cell: (ctx) => {
      const v = ctx.getValue() as number | null; return v ? <span className="tabular-nums">${v.toLocaleString()}</span> : <span className="opacity-60">—</span>;
    } },
    { accessorKey: "status", header: "Estatus", cell: (ctx) => <StateBadge value={ctx.getValue() as string} /> },
    { accessorKey: "created_at", header: "Fecha", cell: (ctx) => new Date(ctx.getValue() as string).toLocaleString() },
    { header: "Acciones", cell: ({ row }) => <RowActions id={row.original.id} onChanged={fetchData} /> },
  ], []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="in_process">En proceso</option>
          <option value="completed">Completados</option>
          <option value="cancelled">Cancelados</option>
        </select>
        <Input placeholder="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} className="h-9 w-36" />
        <Input placeholder="Categoría" value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-36" />
        <DateRangePicker from={from} to={to} onChange={({ from, to }) => { setFrom(from); setTo(to); }} />
        <Input placeholder="Min $" value={minBudget} onChange={(e) => setMinBudget(e.target.value)} className="h-9 w-24" />
        <Input placeholder="Max $" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} className="h-9 w-24" />
        <Button variant="outline" size="sm" onClick={() => { setPage(1); void fetchData(); }}>Aplicar</Button>
        <a
          href={`/api/admin/requests/export${(() => { const p = new URLSearchParams(); if (status) p.set("status", status); if (city) p.set("city", city); if (category) p.set("category", category); if (from) p.set("from", from); if (to) p.set("to", to); const s = p.toString(); return s ? `?${s}` : ""; })()}`}
          className="h-9 rounded-md border px-3 text-sm inline-flex items-center"
        >
          Exportar CSV
        </a>
      </div>
      <DataTable columns={cols} data={data} loading={loading} sorting={sorting} onSortingChange={(next) => setSorting(next)} />
      <div className="flex items-center justify-between text-sm">
        <div>{total} resultados</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button>
          <div>Página {page}</div>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={data.length < pageSize}>Siguiente</Button>
          <select value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }} className="h-8 rounded-md border px-2">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function RowActions({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [dt, setDt] = useState("");
  const [pro, setPro] = useState("");
  async function patch(data: Record<string, unknown>) {
    await fetch(`/api/admin/requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    onChanged();
  }
  return (
    <div className="flex gap-2">
      <a href={`/admin/requests/${id}`} className="text-primary">Ver</a>
      <button className="text-foreground/80" onClick={() => setOpen('schedule')}>Reagendar</button>
      <button className="text-foreground/80" onClick={() => setOpen('reassign')}>Reasignar pro</button>
      <button className="text-destructive" onClick={() => void patch({ status: 'completed' })}>Cerrar</button>
      {open === 'schedule' ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30">
          <div className="w-full max-w-sm rounded-lg bg-background p-4 shadow">
            <div className="text-sm font-medium">Reagendar</div>
            <div className="mt-2">
              <Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(null)}>Cancelar</Button>
              <Button size="sm" onClick={async () => { await patch({ scheduled_for: dt }); setOpen(null); }}>Guardar</Button>
            </div>
          </div>
        </div>
      ) : null}
      {open === 'reassign' ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30">
          <div className="w-full max-w-sm rounded-lg bg-background p-4 shadow">
            <div className="text-sm font-medium">Reasignar profesional</div>
            <div className="mt-2">
              <Input placeholder="professional_id (uuid)" value={pro} onChange={(e) => setPro(e.target.value)} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(null)}>Cancelar</Button>
              <Button size="sm" onClick={async () => { await patch({ professional_id: pro }); setOpen(null); }}>Guardar</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}





