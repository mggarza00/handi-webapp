"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import DataTable from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";

type Pro = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  categories: string[] | null;
  cities: string[] | null;
  ratingAvg: number | null;
  reviewsCount: number;
};

type ApiResponse = {
  items: Pro[];
  total: number;
  page: number;
  pageSize: number;
};

export default function AdminProfessionalsPage() {
  const [items, setItems] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const r = await fetch(`/api/admin/professionals?${params.toString()}`, {
      cache: "no-store",
    });
    const j = (await r.json()) as ApiResponse;
    setItems(j.items || []);
    setTotal(j.total || 0);
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const columns = useMemo(
    () => [
      { accessorKey: "full_name", header: "Nombre" },
      {
        accessorKey: "email",
        header: "Correo",
        cell: (ctx: { getValue: () => unknown }) =>
          (ctx.getValue() as string) || "",
      },
      {
        accessorKey: "phone",
        header: "Teléfono",
        cell: (ctx: { getValue: () => unknown }) =>
          (ctx.getValue() as string) || "",
      },
      {
        accessorKey: "categories",
        header: "Categorías",
        cell: (ctx: { getValue: () => unknown }) => {
          const v = ctx.getValue();
          if (Array.isArray(v)) return v.join(", ");
          if (typeof v === "string") return v;
          return "-";
        },
      },
      {
        accessorKey: "ratingAvg",
        header: "Rating",
        cell: (ctx: { getValue: () => unknown }) =>
          typeof ctx.getValue() === "number" ? `${ctx.getValue()}` : "-",
      },
      {
        accessorKey: "cities",
        header: "Ciudades",
        cell: (ctx: { getValue: () => unknown }) => {
          const v = ctx.getValue();
          if (Array.isArray(v)) return v.join(", ");
          if (typeof v === "string") return v;
          return "-";
        },
      },
      {
        header: "Acciones",
        cell: ({ row }: { row: { original: Pro } }) => (
          <Link
            href={`/admin/professionals/${row.original.id}`}
            className="text-primary text-sm"
          >
            Ver
          </Link>
        ),
      },
    ],
    [],
  );

  const hasNext = page * pageSize < total;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/admin/professionals/export"
            className="h-9 rounded-md border px-3 text-sm inline-flex items-center"
          >
            Exportar CSV
          </a>
        </div>
      </div>
      <DataTable columns={columns} data={items} loading={loading} />
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
