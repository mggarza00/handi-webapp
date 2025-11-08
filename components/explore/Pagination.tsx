"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  pageSize: number;
  total: number;
};

function getPages(current: number, totalPages: number): (number | "...")[] {
  const max = totalPages;
  if (max <= 7) return Array.from({ length: max }, (_, i) => i + 1);
  const pages = new Set<number>();
  pages.add(1);
  pages.add(2);
  pages.add(max - 1);
  pages.add(max);
  [current - 1, current, current + 1].forEach((p) => {
    if (p >= 1 && p <= max) pages.add(p);
  });
  const list = Array.from(pages).sort((a, b) => a - b);
  const out: (number | "...")[] = [];
  let prev: number | null = null;
  for (const p of list) {
    if (prev != null && p - prev > 1) out.push("...");
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Pagination({ page, pageSize, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const pages = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));

  const go = (p: number) => {
    const base = sp?.toString() ?? "";
    const next = new URLSearchParams(base);
    next.set("page", String(Math.min(Math.max(1, p), pages)));
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname || "/");
  };

  if (pages <= 1) return null;

  const items = getPages(page, pages);

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-700">
      <div className="min-w-0">
        Página {page} de {pages} · {total} resultados
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => go(page - 1)} disabled={page <= 1}>
          Anterior
        </Button>
        {items.map((it, idx) =>
          it === "..." ? (
            <span key={`dots-${idx}`} className="px-2 text-slate-400 select-none">
              …
            </span>
          ) : (
            <Button
              key={it}
              variant={it === page ? "default" : "outline"}
              size="sm"
              onClick={() => go(it)}
            >
              {it}
            </Button>
          ),
        )}
        <Button variant="outline" size="sm" onClick={() => go(page + 1)} disabled={page >= pages}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
