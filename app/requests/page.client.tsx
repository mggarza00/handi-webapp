"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SquarePen, Save, X, Trash2 } from "lucide-react";

import type { RequestDetail as RequestDetailType } from "./[id]/RequestDetailClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusMultiSelect from "@/components/filters/StatusMultiSelect";

const RequestDetailClient = dynamic(() => import("./[id]/RequestDetailClient"), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-3 text-sm text-slate-500">Cargando detalle...</div>
  ),
});

type RequestItem = {
  id: string;
  title?: string | null;
  city?: string | null;
  status?: string | null;
  created_at?: string | null;
  attachments?: Array<{ url?: string | null }> | null;
  photos?: Array<{ url: string }> | null;
};

const DEFAULT_REQUEST_IMAGE = "/images/default-requests-image.png";

const STATUS_OPTIONS = [
  { value: "active", label: "Activas" },
  { value: "in_process", label: "En proceso" },
  { value: "completed", label: "Completadas" },
  { value: "cancelled", label: "Canceladas" },
] as const;

function statusLabel(status?: string | null) {
  const key = (status ?? "").toLowerCase();
  // Compat mapeos
  if (key === "canceled") return "Canceladas";
  if (key === "finished") return "Completadas";
  const option = STATUS_OPTIONS.find((opt) => opt.value === key);
  if (option) return option.label;
  if (!key) return "Sin estatus";
  return key.replace(/_/g, " ");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function extractImage(item: RequestItem): string | null {
  const consume = (value?: string | null) => {
    const url = typeof value === "string" ? value.trim() : "";
    return url.length > 0 ? url : null;
  };

  if (Array.isArray(item.attachments)) {
    for (const att of item.attachments) {
      const next = consume(att?.url ?? null);
      if (next) return next;
    }
  }
  if (Array.isArray(item.photos) && item.photos.length) {
    const next = consume(item.photos[0]?.url);
    if (next) return next;
  }
  return null;
}

export default function RequestsClientPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams?.get("status") ?? undefined;
  const city = searchParams?.get("city") ?? undefined;
  const mine = searchParams?.get("mine") ?? undefined;
  const isMy = mine === "1" || mine === "true";

  const [items, setItems] = React.useState<RequestItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<Record<string, RequestDetailType | undefined>>({});
  const [loadingDetail, setLoadingDetail] = React.useState<string | null>(null);

  const handleNavigate = React.useCallback((id: string) => {
    router.push(`/requests/${id}`);
  }, [router]);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      const effectiveStatus = status || (isMy ? "active,in_process" : undefined);
      if (effectiveStatus) qs.set("status", effectiveStatus);
      if (city) qs.set("city", city);
      if (isMy) qs.set("mine", "1");
      const res = await fetch(`/api/requests${qs.toString() ? `?${qs.toString()}` : ""}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Request failed");
      const data = Array.isArray(json?.data) ? (json.data as RequestItem[]) : [];
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "UNKNOWN");
    } finally {
      setLoading(false);
    }
  }, [status, city, isMy]);

  React.useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // Default statuses for "Mis solicitudes": Activas + En proceso
  React.useEffect(() => {
    if (!isMy) return;
    const hasStatus = typeof status === "string" && status.trim().length > 0;
    if (!hasStatus) {
      const defaults = "active,in_process";
      updateSearch({ status: defaults, mine: "1" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMy]);

  const loadDetail = React.useCallback(
    async (id: string) => {
      if (details[id]) return;
      setLoadingDetail(id);
      try {
        const res = await fetch(`/api/requests/${id}`, {
          cache: "no-store",
          credentials: "include",
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.data) {
          setDetails((prev) => ({ ...prev, [id]: json.data as RequestDetailType }));
        }
      } finally {
        setLoadingDetail(null);
      }
    },
    [details],
  );

  const visibleItems = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    const base = !term
      ? items
      : items.filter((item) => {
        const title = (item.title ?? "").toLowerCase();
        const cityValue = (item.city ?? "").toLowerCase();
        const statusValue = (item.status ?? "").toLowerCase();
        return title.includes(term) || cityValue.includes(term) || statusValue.includes(term);
      });
    // Priorizar 'in_process' al inicio manteniendo orden relativo
    const inProc = base.filter((it) => (it.status ?? "").toLowerCase() === "in_process");
    const rest = base.filter((it) => (it.status ?? "").toLowerCase() !== "in_process");
    return [...inProc, ...rest];
  }, [items, query]);

  function updateSearch(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    Object.entries(next).forEach(([key, value]) => {
      if (value && value.length > 0) params.set(key, value);
      else params.delete(key);
    });
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handleExpand(id: string) {
    setExpandedId((prev) => {
      const next = prev === id ? null : id;
      if (next) void loadDetail(id);
      return next;
    });
  }

  function handleSave(id: string) {
    window.dispatchEvent(new CustomEvent("request-save", { detail: { id } }));
  }

  function handleCancel(id: string) {
    window.dispatchEvent(new CustomEvent("request-cancel", { detail: { id } }));
    setExpandedId(null);
  }

  function handleDelete(id: string) {
    window.dispatchEvent(new CustomEvent("request-delete", { detail: { id } }));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isMy ? "Mis solicitudes" : "Solicitudes"}
          </h1>
          <p className="text-sm text-slate-500">
            Administra tus solicitudes activas, filtra por estatus y consulta los detalles.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_auto] md:items-end">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <StatusMultiSelect
            value={status ?? (isMy ? "active,in_process" : "")}
            onChange={(csv) => updateSearch({ status: csv || undefined })}
          />
        </div>
        {!isMy ? (
          <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-end md:gap-3">
            <div className="flex-1 md:max-w-xs">
              <Label className="sr-only">Buscar</Label>
              <Input
                placeholder="Buscar por titulo, ciudad o estatus"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="mine"
                type="checkbox"
                className="size-4"
                checked={isMy}
                onChange={(event) =>
                  updateSearch({ mine: event.target.checked ? "1" : undefined })
                }
              />
              <Label htmlFor="mine" className="text-sm">
                Mis solicitudes
              </Label>
            </div>
            <Button
              variant="outline"
              onClick={() => updateSearch({ status: undefined, city: undefined, mine: undefined })}
            >
              Limpiar filtros
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-slate-500">Cargando...</p> : null}
      {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}

      {!loading && !error ? (
        <div className="space-y-3">
          {visibleItems.length ? (
            visibleItems.map((item) => {
              const preview = extractImage(item) ?? DEFAULT_REQUEST_IMAGE;
              const isExpanded = expandedId === item.id;
              const detail = details[item.id];
              return (
                <div
                  key={item.id}
                  className={[
                    "rounded-3xl border shadow-sm transition hover:shadow-md",
                    (item.status ?? "").toLowerCase() === "in_process" ? "bg-blue-50" : "bg-white",
                  ].join(" ")}
                >
                  <div
                    className="flex items-center gap-4 p-4"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNavigate(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleNavigate(item.id);
                      }
                    }}
                  >
                    <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-2xl bg-orange-100">
                      <Image
                        src={preview}
                        alt={item.title ?? "Solicitud"}
                        width={56}
                        height={56}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="truncate text-base font-semibold text-slate-900">
                        {item.title ?? "Solicitud"}
                      </h2>
                      <div className="text-sm text-slate-500">
                        {(item.city ?? "").trim() || "Sin ciudad"} - {statusLabel(item.status)} - {formatDate(item.created_at)}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleExpand(item.id);
                      }}
                      aria-label="Editar solicitud"
                    >
                      <SquarePen className="h-4 w-4" />
                    </Button>
                  </div>
                  {isExpanded ? (
                    <div
                      className="border-t px-4 pb-4"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold text-slate-900">
                            {(detail?.title ?? item.title) || "Solicitud"}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {(detail?.city ?? item.city) || "Sin ciudad"} - {statusLabel(detail?.status ?? item.status)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSave(item.id);
                            }}
                            title="Guardar"
                            aria-label="Guardar"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCancel(item.id);
                            }}
                            title="Cerrar"
                            aria-label="Cerrar"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDelete(item.id);
                            }}
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {loadingDetail === item.id && !detail ? (
                        <div className="px-2 py-4 text-sm text-slate-500">Cargando detalle...</div>
                      ) : detail ? (
                        <RequestDetailClient
                          initial={detail}
                          startInEdit
                          compactActions
                          hideHeader
                          onSaved={async () => {
                            await fetchList();
                            setExpandedId(null);
                          }}
                          onDeleted={async () => {
                            await fetchList();
                            setExpandedId(null);
                          }}
                        />
                      ) : (
                        <div className="px-2 py-4 text-sm text-slate-500">
                          No se pudo cargar el detalle.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed p-6 text-center text-sm text-slate-500">
              {isMy ? (
                <div className="space-y-2">
                  <p className="font-medium text-slate-700">Aun no tienes solicitudes.</p>
                  <p>Crea una solicitud para recibir propuestas de profesionales.</p>
                  <Button asChild variant="outline">
                    <Link href="/requests/new">Crear nueva solicitud</Link>
                  </Button>
                </div>
              ) : (
                <span>No hay solicitudes que coincidan con los filtros.</span>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
