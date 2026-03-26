"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import RequestCard from "@/components/explore/RequestCard";
import { supabaseBrowser } from "@/lib/supabase-browser";

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

type SortValue = "recent" | "budget_desc" | "category_asc";

export default function RequestsList({
  proId,
  initialItems,
  sort,
  subcategoryIconMap = {},
  categoryIconMap = {},
  subcategoryColorMap = {},
  categoryColorMap = {},
}: {
  proId: string;
  initialItems: RequestsListItem[];
  sort: SortValue;
  subcategoryIconMap?: Record<string, string>;
  categoryIconMap?: Record<string, string>;
  subcategoryColorMap?: Record<string, string>;
  categoryColorMap?: Record<string, string>;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<RequestsListItem[]>(
    Array.isArray(initialItems) ? initialItems.slice() : [],
  );

  // Sync local state when server-provided items change (filter/page updates)
  React.useEffect(() => {
    setItems(Array.isArray(initialItems) ? initialItems.slice() : []);
  }, [initialItems, sort]);

  React.useEffect(() => {
    if (!proId) return;
    const supabase = supabaseBrowser;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const channel = supabase
      .channel(`requests-explore:${proId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requests",
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [proId, router]);

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
    <ul className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {items.map((request) => (
        <li key={request.id} className="h-full">
          <RequestCard
            request={request}
            subcategoryIconMap={subcategoryIconMap}
            categoryIconMap={categoryIconMap}
            subcategoryColorMap={subcategoryColorMap}
            categoryColorMap={categoryColorMap}
          />
        </li>
      ))}
    </ul>
  );
}
