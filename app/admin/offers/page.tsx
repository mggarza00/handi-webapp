"use client";
import { useEffect, useState } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Offer = {
  id: string;
  amount: number;
  currency: string;
  status: "sent" | "accepted" | "rejected" | "expired" | "canceled" | "paid";
  client: string;
  professional: string;
  created_at: string;
};

export default function AdminOffersPage() {
  const [items, setItems] = useState<Offer[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const r = await fetch(`/api/admin/offers${params.toString() ? `?${params}` : ""}`, { cache: "no-store" });
    const j = await r.json();
    setItems(j.items as Offer[]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">Todos</option>
          <option value="sent">Enviadas</option>
          <option value="accepted">Aceptadas</option>
          <option value="rejected">Rechazadas</option>
          <option value="expired">Expiradas</option>
          <option value="canceled">Canceladas</option>
          <option value="paid">Pagadas</option>
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        <Button variant="outline" size="sm" onClick={fetchData}>Filtrar</Button>
        <a
          href={`/api/admin/offers/export${(() => { const p = new URLSearchParams(); if (status) p.set("status", status); if (from) p.set("from", from); if (to) p.set("to", to); const s = p.toString(); return s ? `?${s}` : ""; })()}`}
          className="h-9 rounded-md border px-3 text-sm inline-flex items-center"
        >
          Exportar CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Profesional</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.id}</TableCell>
                <TableCell className="tabular-nums">{o.amount.toLocaleString()} {o.currency}</TableCell>
                <TableCell>{o.status}</TableCell>
                <TableCell>{o.client}</TableCell>
                <TableCell>{o.professional}</TableCell>
                <TableCell>{new Date(o.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
