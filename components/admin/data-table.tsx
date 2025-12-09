"use client";
import * as React from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmptyState from "@/components/admin/empty-state";

export default function DataTable<TData>({ columns, data, loading, sorting, onSortingChange }: { columns: ColumnDef<TData, unknown>[]; data: TData[]; loading?: boolean; sorting?: SortingState; onSortingChange?: (updater: SortingState) => void }) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(sorting || []);
  const effectiveSorting = sorting ?? internalSorting;
  const table = useReactTable({
    data,
    columns,
    state: { sorting: effectiveSorting },
    onSortingChange: (updater) => {
      const next = Array.isArray(updater) ? updater : updater(effectiveSorting);
      if (onSortingChange) onSortingChange(next as SortingState);
      else setInternalSorting(next as SortingState);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  if (loading) return <div className="text-sm text-muted-foreground">Cargando…</div>;
  if (!data?.length) return <EmptyState />;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} onClick={h.column.getToggleSortingHandler()} className="cursor-pointer select-none">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
