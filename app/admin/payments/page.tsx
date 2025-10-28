"use client";
import { useEffect, useState } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "refunded" | "failed" | "canceled" | "disputed";
  customer: string;
  created_at: string;
};

export default function AdminPaymentsPage() {
  const [items, setItems] = useState<Payment[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const r = await fetch(`/api/admin/payments${params.toString() ? `?${params}` : ""}`, { cache: "no-store" });
    const j = await r.json();
    setItems(j.items as Payment[]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        <Button variant="outline" size="sm" onClick={fetchData}>Filtrar</Button>
        <a
          href={`/api/admin/payments/export${(() => { const p = new URLSearchParams(); if (from) p.set("from", from); if (to) p.set("to", to); const s = p.toString(); return s ? `?${s}` : ""; })()}`}
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
              <TableHead>Estado</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell className="tabular-nums">{p.amount.toLocaleString()} {p.currency}</TableCell>
                <TableCell>{p.status}</TableCell>
                <TableCell>{p.customer}</TableCell>
                <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
