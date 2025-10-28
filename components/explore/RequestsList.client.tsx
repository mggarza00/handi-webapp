"use client";

import * as React from "react";

import RequestCard from "@/components/explore/RequestCard";

export type RequestsListItem = {
  id: string;
  title: string;
  city: string | null;
  required_at?: string | null;
  estimated_budget?: number | null;
  budget?: number | null;
  attachments?: unknown;
  is_favorite: boolean;
};

function sortItems(a: RequestsListItem, b: RequestsListItem) {
  if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
  const ad = a.required_at || "";
  const bd = b.required_at || "";
  return ad.localeCompare(bd);
}

export default function RequestsList({
  proId,
  initialItems,
}: {
  proId: string;
  initialItems: RequestsListItem[];
}) {
  const [items, setItems] = React.useState<RequestsListItem[]>(
    Array.isArray(initialItems) ? initialItems.slice().sort(sortItems) : [],
  );

  // Sync local state when server-provided items change (filter/page updates)
  React.useEffect(() => {
    setItems(Array.isArray(initialItems) ? initialItems.slice().sort(sortItems) : []);
  }, [initialItems]);

  function handleToggled(id: string, fav: boolean) {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, is_favorite: fav } : it));
      next.sort(sortItems);
      return next;
    });
  }

  if (!items.length) {
    return (
      <ul className="space-y-3 mt-3">
        <li className="p-3 text-sm text-gray-600">
          <div className="rounded-2xl border p-4">
            <p className="font-medium">No encontramos solicitudes para tus filtros</p>
            <p className="text-xs text-slate-600 mt-1">Intenta cambiar ciudad/categoría o vuelve más tarde.</p>
          </div>
        </li>
      </ul>
    );
  }

  return (
    <ul className="space-y-3 mt-3">
      {items.map((request) => (
        <li key={request.id}>
          <RequestCard proId={proId} request={request} onFavoriteToggled={handleToggled} />
        </li>
      ))}
    </ul>
  );
}
