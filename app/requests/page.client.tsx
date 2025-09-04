"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RequestItem = {
  id: string;
  title: string;
  city: string | null;
  status: string | null;
  created_at: string | null;
};

export default function RequestsClientPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp?.get("status") ?? undefined;
  const city = sp?.get("city") ?? undefined;
  const mine = sp?.get("mine") ?? undefined;

  const [items, setItems] = React.useState<RequestItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (status) qs.set("status", status);
        if (city) qs.set("city", city);
        if (mine === "1" || mine === "true") qs.set("mine", "1");
        const url = `/api/requests${qs.toString() ? `?${qs.toString()}` : ""}`;
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Request failed");
        setItems(json.data ?? []);
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "UNKNOWN");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [status, city, mine]);

  function updateSearch(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    Object.entries(next).forEach(([k, v]) => {
      if (v && v.length > 0) params.set(k, v);
      else params.delete(k);
    });
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-2">Solicitudes</h1>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={status ?? "all"}
            onValueChange={(v) => updateSearch({ status: v === "all" ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="in_process">En proceso</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ciudad</Label>
          <Input
            placeholder="Monterrey"
            defaultValue={city ?? ""}
            onBlur={(e) => updateSearch({ city: e.target.value || undefined })}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="mine"
            type="checkbox"
            className="size-4"
            checked={mine === "1"}
            onChange={(e) => updateSearch({ mine: e.target.checked ? "1" : undefined })}
          />
          <Label htmlFor="mine">Mis solicitudes</Label>
        </div>
        <div className="md:justify-self-end">
          <Button onClick={() => updateSearch({ status: undefined, city: undefined, mine: undefined })} variant="outline">
            Limpiar filtros
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm">Cargando…</p>}
      {error && <p className="text-sm text-red-600">Error: {error}</p>}
      {!loading && !error && (
        <ul className="divide-y rounded border">
          {items?.length ? (
            items.map((it) => (
              <li key={it.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{it.title}</p>
                    <p className="text-xs text-gray-500">
                      {it.city ?? "—"} · {it.status ?? "active"} · {it.created_at?.slice(0, 10) ?? ""}
                    </p>
                  </div>
                  <a href={`/requests/${it.id}`} className="text-sm text-blue-600 hover:underline">
                    Ver
                  </a>
                </div>
              </li>
            ))
          ) : (
            <li className="p-3 text-sm text-gray-500">Sin resultados</li>
          )}
        </ul>
      )}
    </div>
  );
}
