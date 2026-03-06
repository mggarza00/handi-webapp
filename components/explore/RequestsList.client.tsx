"use client";

import * as React from "react";

import RequestCard from "@/components/explore/RequestCard";

export type RequestsListItem = {
  id: string;
  title: string;
  city: string | null;
  category?: string | null;
  subcategory?: string | null;
  created_at?: string | null;
  required_at?: string | null;
  estimated_budget?: number | null;
  budget?: number | null;
  attachments?: unknown;
  client_name?: string | null;
  client_avatar_url?: string | null;
  is_favorite: boolean;
};

type SortValue = "recent" | "required";

function sortItems(a: RequestsListItem, b: RequestsListItem, sort: SortValue) {
  if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
  if (sort === "required") {
    return (a.required_at || "").localeCompare(b.required_at || "");
  }
  return (b.created_at || "").localeCompare(a.created_at || "");
}

export default function RequestsList({
  proId,
  initialItems,
  sort,
  subcategoryIconMap = {},
}: {
  proId: string;
  initialItems: RequestsListItem[];
  sort: SortValue;
  subcategoryIconMap?: Record<string, string>;
}) {
  const [items, setItems] = React.useState<RequestsListItem[]>(
    Array.isArray(initialItems)
      ? initialItems.slice().sort((a, b) => sortItems(a, b, sort))
      : [],
  );

  // Sync local state when server-provided items change (filter/page updates)
  React.useEffect(() => {
    setItems(
      Array.isArray(initialItems)
        ? initialItems.slice().sort((a, b) => sortItems(a, b, sort))
        : [],
    );
  }, [initialItems, sort]);

  function handleToggled(id: string, fav: boolean) {
    setItems((prev) => {
      const next = prev.map((it) =>
        it.id === id ? { ...it, is_favorite: fav } : it,
      );
      next.sort((a, b) => sortItems(a, b, sort));
      return next;
    });
  }

  if (!items.length) {
    return (
      <div className="mt-4 rounded-2xl border p-6 text-center text-sm text-gray-600">
        <div className="mx-auto max-w-md rounded-2xl border bg-white p-4">
          <p className="font-medium">
            No encontramos solicitudes para tus filtros
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Intenta cambiar ciudad/categoría o vuelve más tarde.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((request) => (
        <li key={request.id}>
          <RequestCard
            proId={proId}
            request={request}
            onFavoriteToggled={handleToggled}
            subcategoryIconMap={subcategoryIconMap}
          />
        </li>
      ))}
    </ul>
  );
}
