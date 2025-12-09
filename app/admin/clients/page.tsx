"use client";
import { useEffect, useState } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Client = {
  id: string;
  full_name: string | null;
  city: string | null;
  created_at: string | null;
};

export default function AdminClientsPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city) params.set("city", city);
    const r = await fetch(`/api/admin/clients${params.toString() ? `?${params}` : ""}`, { cache: "no-store" });
    const j = await r.json();
    setItems(j.items as Client[]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar nombre o ID" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64" />
        <Input placeholder="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} className="h-9 w-40" />
        <Button variant="outline" size="sm" onClick={fetchData}>Filtrar</Button>
        <a
          href={`/api/admin/clients/export${(() => { const p = new URLSearchParams(); if (q) p.set("q", q); if (city) p.set("city", city); const s = p.toString(); return s ? `?${s}` : ""; })()}`}
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
              <TableHead>Nombre</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.id.slice(0, 8)}</TableCell>
                <TableCell>{c.full_name || "—"}</TableCell>
                <TableCell>{c.city || "—"}</TableCell>
                <TableCell>{c.created_at ? new Date(c.created_at).toLocaleString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
