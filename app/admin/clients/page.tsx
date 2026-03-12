"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import DataTable from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { normalizeAvatarUrl } from "@/lib/avatar";

type Client = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  created_at: string | null;
  avatar_url: string | null;
};

type ApiResponse = {
  ok: boolean;
  items: Client[];
  total: number;
  page: number;
  pageSize: number;
};

export default function AdminClientsPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [qInput, setQInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (q) params.set("q", q);
      if (city) params.set("city", city);

      const response = await fetch(`/api/admin/clients?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as ApiResponse;
      setItems(json.items || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }, [city, page, pageSize, q]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        accessorKey: "avatar_url",
        header: "Avatar",
        cell: ({ row }) => {
          const client = row.original;
          const displayName = client.full_name?.trim() || "Cliente";
          return (
            <Avatar className="size-9 border bg-background shadow-sm">
              <AvatarImage
                src={normalizeAvatarUrl(client.avatar_url) || undefined}
                alt={displayName}
              />
              <AvatarFallback className="text-xs font-medium">
                {getInitials(displayName, client.id)}
              </AvatarFallback>
            </Avatar>
          );
        },
      },
      {
        accessorKey: "full_name",
        header: "Nombre",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">
              {row.original.full_name?.trim() || "Sin nombre"}
            </div>
            <div className="text-xs text-muted-foreground">
              ID: {shortId(row.original.id)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Correo",
        cell: ({ row }) => row.original.email || "-",
      },
      {
        accessorKey: "phone",
        header: "Telefono",
        cell: ({ row }) => row.original.phone || "-",
      },
      {
        accessorKey: "city",
        header: "Ciudad",
        cell: ({ row }) => row.original.city || "-",
      },
      {
        accessorKey: "created_at",
        header: "Registro",
        cell: ({ row }) => formatCreatedAt(row.original.created_at),
      },
      {
        header: "Acciones",
        cell: ({ row }) => (
          <Link
            href={`/admin/clients/${row.original.id}`}
            className="text-primary text-sm font-medium hover:underline"
          >
            Ver
          </Link>
        ),
      },
    ],
    [],
  );

  const hasNext = page * pageSize < total;

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city) params.set("city", city);
    const query = params.toString();
    return `/api/admin/clients/export${query ? `?${query}` : ""}`;
  }, [city, q]);

  const applyFilters = () => {
    setPage(1);
    setQ(qInput.trim());
    setCity(cityInput.trim());
  };

  const clearFilters = () => {
    setQInput("");
    setCityInput("");
    setQ("");
    setCity("");
    setPage(1);
  };

  const subtitle =
    q || city
      ? "Resultados filtrados de clientes."
      : "Listado administrativo de clientes.";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Input
                placeholder="Buscar por nombre, correo, telefono o ID"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                className="h-9 sm:w-72"
              />
              <Input
                placeholder="Ciudad"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                className="h-9 sm:w-48"
              />
              <Button variant="outline" size="sm" onClick={applyFilters}>
                Filtrar
              </Button>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar
              </Button>
            </div>
            <a
              href={exportHref}
              className="h-9 rounded-md border px-3 text-sm inline-flex items-center justify-center"
            >
              Exportar CSV
            </a>
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={items} loading={loading} />

      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>{total} resultados</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <div>Pagina {page}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={!hasNext}
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

function shortId(value: string): string {
  return value.slice(0, 8);
}

function getInitials(name: string, id: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!words.length) return shortId(id).slice(0, 2).toUpperCase();
  return words.map((word) => word[0]?.toUpperCase() || "").join("");
}

function formatCreatedAt(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
