"use client";

import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import DataTable from "@/components/admin/data-table";
import StateBadge from "@/components/admin/state-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SupportCase = {
  id: string;
  short_id: string;
  subject: string | null;
  priority: "baja" | "media" | "alta" | "critica";
  status: "nuevo" | "en_proceso" | "esperando_cliente" | "resuelto" | "cerrado";
  type: string;
  channel_origin: string;
  assigned_admin_id: string | null;
  assigned_name?: string | null;
  user_name?: string | null;
  last_activity_at: string;
  sla_due_at: string | null;
  sla_risk?: boolean;
};

export default function AdminDisputasPage() {
  const [items, setItems] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [type, setType] = useState("");
  const [slaRisk, setSlaRisk] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  async function fetchData() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (type) params.set("type", type);
    if (slaRisk) params.set("slaRisk", "1");
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/cases?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json();
    setItems((json.items || []) as SupportCase[]);
    setTotal(json.total ?? 0);
    setLoading(false);
  }

  const columns = useMemo<ColumnDef<SupportCase>[]>(() => {
    return [
      {
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.short_id}</span>
        ),
      },
      {
        header: "Usuario",
        cell: ({ row }) => row.original.user_name || "—",
      },
      {
        accessorKey: "subject",
        header: "Asunto",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Link
              href={`/admin/disputas/${row.original.id}`}
              className="font-medium hover:underline"
            >
              {row.original.subject || "Sin asunto"}
            </Link>
            <span className="text-xs text-muted-foreground">
              {row.original.type}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "priority",
        header: "Prioridad",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.priority === "critica" ? "destructive" : "outline"
            }
          >
            {row.original.priority}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => <StateBadge value={row.original.status} />,
      },
      { header: "Canal", cell: ({ row }) => row.original.channel_origin },
      {
        header: "Asignado",
        cell: ({ row }) => row.original.assigned_name || "—",
      },
      {
        header: "SLA",
        cell: ({ row }) =>
          row.original.sla_due_at ? (
            <span
              className={`text-xs ${row.original.sla_risk ? "text-red-600" : "text-muted-foreground"}`}
            >
              vence {new Date(row.original.sla_due_at).toLocaleString()}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "last_activity_at",
        header: "Última actividad",
        cell: ({ row }) =>
          new Date(row.original.last_activity_at).toLocaleString(),
      },
    ];
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Todos</option>
          <option value="nuevo">Nuevo</option>
          <option value="en_proceso">En proceso</option>
          <option value="esperando_cliente">Esperando cliente</option>
          <option value="resuelto">Resuelto</option>
          <option value="cerrado">Cerrado</option>
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Todas</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Tipo</option>
          <option value="pago">Pago</option>
          <option value="servicio_no_realizado">Servicio no realizado</option>
          <option value="problema_tecnico">Problema técnico</option>
          <option value="reembolso">Reembolso</option>
          <option value="queja">Queja</option>
          <option value="otro">Otro</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={slaRisk}
            onChange={(e) => setSlaRisk(e.target.checked)}
          />
          SLA en riesgo
        </label>
        <Input
          placeholder="Buscar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 w-56"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPage(1);
            void fetchData();
          }}
        >
          Filtrar
        </Button>
      </div>
      <DataTable data={items} columns={columns} loading={loading} />
      <div className="flex items-center justify-between text-sm">
        <div>{total} resultados</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <div>Página {page}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={items.length < pageSize}
          >
            Siguiente
          </Button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="h-8 rounded-md border px-2"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
}
