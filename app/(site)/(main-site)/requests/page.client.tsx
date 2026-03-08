"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BriefcaseBusiness,
  Calendar,
  CalendarClock,
  Car,
  Check,
  ChevronsUpDown,
  Droplets,
  Hammer,
  Home,
  KeyRound,
  Leaf,
  MapPin,
  Paintbrush,
  PawPrint,
  Plug,
  Save,
  Sparkles,
  SquarePen,
  Tag,
  Trash2,
  Truck,
  Wind,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import type { RequestDetail as RequestDetailType } from "./[id]/RequestDetailClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import StatusMultiSelect from "@/components/filters/StatusMultiSelect";
import CreateRequestButton from "@/components/requests/CreateRequestButton";
import { formatCurrencyMXN } from "@/lib/format";

const RequestDetailClient = dynamic(
  () => import("./[id]/RequestDetailClient"),
  {
    ssr: false,
    loading: () => (
      <div className="px-4 py-3 text-sm text-slate-500">
        Cargando detalle...
      </div>
    ),
  },
);

type RequestItem = {
  id: string;
  title?: string | null;
  city?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  required_at?: string | null;
  category?: string | null;
  subcategory?: string | null;
  subcategories?: unknown;
  budget?: number | null;
  estimated_budget?: number | null;
  attachments?: Array<{ url?: string | null }> | null;
  photos?: Array<{ url?: string | null }> | null;
};

const STATUS_OPTIONS = [
  { value: "active", label: "Activa" },
  { value: "in_process", label: "En proceso" },
  { value: "completed", label: "Completada" },
  { value: "cancelled", label: "Cancelada" },
] as const;

const SORT_OPTIONS = [
  { value: "recent", label: "Mas recientes" },
  { value: "oldest", label: "Mas antiguas" },
  { value: "status", label: "Por estatus" },
] as const;

function SecurityBadgeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.8c2 .9 4 1.2 6.2 1.2v5.4c0 4.2-2.8 7.8-6.2 9.8-3.4-2-6.2-5.6-6.2-9.8V5c2.2 0 4.2-.3 6.2-1.2Z" />
      <path d="m12 8.2.9 1.9 2.1.2-1.6 1.4.5 2.1-1.9-1.1-1.9 1.1.5-2.1-1.6-1.4 2.1-.2.9-1.9Z" />
      <path d="M9.2 15.6h5.6" />
    </svg>
  );
}

function MosaicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </svg>
  );
}

function statusLabel(status?: string | null) {
  const key = (status ?? "").toLowerCase();
  if (key === "canceled") return "Cancelada";
  if (key === "finished") return "Completada";
  const option = STATUS_OPTIONS.find((opt) => opt.value === key);
  if (option) return option.label;
  if (!key) return "Sin estatus";
  return key.replace(/_/g, " ");
}

function statusUi(status?: string | null) {
  const key = (status ?? "").toLowerCase();
  const label = statusLabel(status);
  if (key === "active") {
    return {
      label,
      badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
      cardClass: "border-2 border-blue-200 bg-white",
    };
  }
  if (key === "in_process") {
    return {
      label,
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
      cardClass: "border-2 border-emerald-200 bg-white",
    };
  }
  if (key === "completed" || key === "finished") {
    return {
      label,
      badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
      cardClass: "border-2 border-purple-200 bg-white",
    };
  }
  if (key === "cancelled" || key === "canceled" || key === "deleted") {
    return {
      label,
      badgeClass: "bg-red-100 text-red-800 border-red-200",
      cardClass: "border-2 border-red-200 bg-white",
    };
  }
  return {
    label,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    cardClass: "border border-slate-200 bg-white",
  };
}

function normalizeText(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function cleanToken(value?: string | null): string {
  if (!value) return "";
  return (
    value
      .split(/[|/,:\-·]+/)
      .map((part) => part.trim())
      .filter(Boolean)[0] || ""
  );
}

function extractSubcategory(item: RequestItem): string | null {
  if (typeof item.subcategory === "string" && item.subcategory.trim()) {
    return item.subcategory.trim();
  }
  const raw = item.subcategories;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0] as unknown;
  if (typeof first === "string") {
    const t = first.trim();
    return t || null;
  }
  if (first && typeof first === "object" && "name" in first) {
    const name = (first as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

function simplifyCategory(item: RequestItem): string {
  const category = cleanToken(item.category);
  const subcategory = cleanToken(extractSubcategory(item));
  if (!category && !subcategory) return "Sin categoria";
  if (!subcategory) return category;
  if (!category) return subcategory;
  if (category.toLowerCase().includes(subcategory.toLowerCase()))
    return subcategory;
  if (subcategory.toLowerCase().includes(category.toLowerCase()))
    return category;
  return subcategory.length <= category.length ? subcategory : category;
}

function resolvePlaceholderIcon(item: RequestItem) {
  const primary = simplifyCategory(item);
  const source = `${normalizeText(item.category)} ${normalizeText(extractSubcategory(item))} ${normalizeText(primary)}`;

  if (
    source.includes("jardiner") ||
    source.includes("exterior") ||
    source.includes("pasto")
  )
    return Leaf;
  if (
    source.includes("plomer") ||
    source.includes("fuga") ||
    source.includes("tuber") ||
    source.includes("agua")
  )
    return Droplets;
  if (source.includes("electric") || source.includes("volt")) return Zap;
  if (
    source.includes("instal") ||
    source.includes("manten") ||
    source.includes("repar")
  )
    return Wrench;
  if (source.includes("limpieza") || source.includes("aseo")) return Sparkles;
  if (source.includes("pint")) return Paintbrush;
  if (
    source.includes("piso") ||
    source.includes("loseta") ||
    source.includes("azulejo") ||
    source.includes("porcelanato") ||
    source.includes("duela") ||
    source.includes("laminado") ||
    source.includes("vinil")
  )
    return MosaicIcon;
  if (
    source.includes("carpinter") ||
    source.includes("mueble") ||
    source.includes("ebanist")
  )
    return Hammer;
  if (
    source.includes("mascota") ||
    source.includes("veter") ||
    source.includes("pet")
  )
    return PawPrint;
  if (
    source.includes("transporte") ||
    source.includes("carga") ||
    source.includes("mudanza") ||
    source.includes("flete")
  )
    return Truck;
  if (
    source.includes("seguridad") ||
    source.includes("guardia") ||
    source.includes("vigilancia")
  )
    return SecurityBadgeIcon;
  if (source.includes("cerra") || source.includes("llave")) return KeyRound;
  if (
    source.includes("aire") ||
    source.includes("clima") ||
    source.includes("ventila")
  )
    return Wind;
  if (
    source.includes("electrodom") ||
    source.includes("refriger") ||
    source.includes("lavadora") ||
    source.includes("secadora") ||
    source.includes("microondas")
  )
    return Plug;
  if (
    source.includes("constru") ||
    source.includes("alban") ||
    source.includes("obra")
  )
    return Hammer;
  if (source.includes("hogar") || source.includes("casa")) return Home;
  if (source.includes("auto") || source.includes("vehiculo")) return Car;
  return BriefcaseBusiness;
}

function formatDate(value?: string | null) {
  if (!value) return "No definida";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No definida";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
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
  if (Array.isArray(item.photos)) {
    for (const photo of item.photos) {
      const next = consume(photo?.url ?? null);
      if (next) return next;
    }
  }
  return null;
}

function getBudget(item: RequestItem): number | null {
  if (typeof item.estimated_budget === "number") return item.estimated_budget;
  if (typeof item.budget === "number") return item.budget;
  return null;
}

function OrderSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected =
    SORT_OPTIONS.find((opt) => opt.value === value) ?? SORT_OPTIONS[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between rounded-lg w-full whitespace-normal text-left h-auto"
        >
          <span className="flex-1 min-w-0 break-words">{selected.label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandEmpty>Sin resultados</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => onChange(opt.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={
                        isSelected
                          ? "mr-2 h-4 w-4 opacity-100"
                          : "mr-2 h-4 w-4 opacity-0"
                      }
                    />
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function RequestsClientPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams?.get("status") ?? undefined;
  const city = searchParams?.get("city") ?? undefined;
  const mine = searchParams?.get("mine") ?? undefined;
  const sort = searchParams?.get("sort") ?? "recent";
  const isMy = mine === "1" || mine === "true";

  const [items, setItems] = React.useState<RequestItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<
    Record<string, RequestDetailType | undefined>
  >({});
  const [loadingDetail, setLoadingDetail] = React.useState<string | null>(null);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      const effectiveStatus =
        status || (isMy ? "active,in_process" : undefined);
      if (effectiveStatus) qs.set("status", effectiveStatus);
      if (city) qs.set("city", city);
      if (isMy) qs.set("mine", "1");
      const res = await fetch(
        `/api/requests${qs.toString() ? `?${qs.toString()}` : ""}`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Request failed");
      setItems(Array.isArray(json?.data) ? (json.data as RequestItem[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "UNKNOWN");
    } finally {
      setLoading(false);
    }
  }, [status, city, isMy]);

  React.useEffect(() => {
    void fetchList();
  }, [fetchList]);

  React.useEffect(() => {
    if (!isMy) return;
    const hasStatus = typeof status === "string" && status.trim().length > 0;
    if (!hasStatus) {
      updateSearch({ status: "active,in_process", mine: "1" });
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
          setDetails((prev) => ({
            ...prev,
            [id]: json.data as RequestDetailType,
          }));
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
          const categoryValue = (item.category ?? "").toLowerCase();
          const subcategoryValue = (
            extractSubcategory(item) ?? ""
          ).toLowerCase();
          return (
            title.includes(term) ||
            cityValue.includes(term) ||
            statusValue.includes(term) ||
            categoryValue.includes(term) ||
            subcategoryValue.includes(term)
          );
        });

    const inProc = base.filter(
      (it) => (it.status ?? "").toLowerCase() === "in_process",
    );
    const rest = base.filter(
      (it) => (it.status ?? "").toLowerCase() !== "in_process",
    );
    return [...inProc, ...rest];
  }, [items, query]);

  const sortedItems = React.useMemo(() => {
    const list = [...visibleItems];
    if (sort === "oldest") {
      return list.sort((a, b) => {
        const diff = getDateMs(a) - getDateMs(b);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      });
    }
    if (sort === "status") {
      return list.sort((a, b) => {
        const ra = statusRank(a.status);
        const rb = statusRank(b.status);
        if (ra !== rb) return ra - rb;
        const diff = getDateMs(b) - getDateMs(a);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      });
    }
    return list.sort((a, b) => {
      const diff = getDateMs(b) - getDateMs(a);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
  }, [visibleItems, sort]);

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
            Administra tus solicitudes activas, filtra por estatus y consulta
            los detalles.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5 sm:flex-1">
          <Label>Status</Label>
          <StatusMultiSelect
            value={status ?? (isMy ? "active,in_process" : "")}
            onChange={(csv) => updateSearch({ status: csv || undefined })}
          />
        </div>
        <div className="space-y-1.5 sm:w-48">
          <Label>Ordenar</Label>
          <OrderSelect
            value={sort}
            onChange={(value) => updateSearch({ sort: value })}
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
              onClick={() =>
                updateSearch({
                  status: undefined,
                  city: undefined,
                  mine: undefined,
                })
              }
            >
              Limpiar filtros
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-slate-500">Cargando...</p> : null}
      {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}

      {!loading && !error ? (
        <div>
          {sortedItems.length ? (
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {sortedItems.map((item) => {
                const isExpanded = expandedId === item.id;
                const detail = details[item.id];
                const ui = statusUi(item.status);
                const budget = getBudget(item);
                const icon = resolvePlaceholderIcon(item);
                const categoryLabel = simplifyCategory(item);
                const imageUrl = extractImage(item);

                return (
                  <li key={item.id} className="h-full">
                    <article
                      className={[
                        "flex h-full flex-col overflow-hidden rounded-2xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                        ui.cardClass,
                      ].join(" ")}
                    >
                      <Link href={`/requests/${item.id}`} className="block">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt={item.title ?? "Solicitud"}
                            className="h-32 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
                            {React.createElement(icon, {
                              className:
                                icon === SecurityBadgeIcon
                                  ? "h-10 w-10 text-slate-400"
                                  : "h-9 w-9 text-slate-400",
                            })}
                          </div>
                        )}
                      </Link>

                      <div className="flex flex-1 flex-col p-3.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ui.badgeClass}`}
                          >
                            {ui.label}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleExpand(item.id)}
                            aria-label="Editar solicitud"
                            className="h-8 w-8 rounded-lg"
                          >
                            <SquarePen className="h-4 w-4" />
                          </Button>
                        </div>

                        <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-5 text-slate-900">
                          {item.title ?? "Solicitud"}
                        </h3>

                        <div className="mt-3 space-y-0.5">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Presupuesto estimado
                          </p>
                          <p className="text-base font-semibold text-slate-900">
                            {typeof budget === "number"
                              ? formatCurrencyMXN(budget)
                              : "Sin definir"}
                          </p>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-y-2 text-xs text-slate-600">
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-500" />
                            <span className="truncate">
                              {item.city || "Ciudad no definida"}
                            </span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            <span>Creada: {formatDate(item.created_at)}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
                            <span>
                              Requerida: {formatDate(item.required_at)}
                            </span>
                          </p>
                          <div>
                            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              <Tag className="h-3 w-3 shrink-0" />
                              <span className="truncate">{categoryLabel}</span>
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 pt-1">
                          <Link
                            href={`/requests/${item.id}`}
                            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-[#0A2540] hover:bg-[#0A2540] hover:text-white"
                          >
                            Ver solicitud
                          </Link>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div
                          className="border-t px-3.5 pb-3.5"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold text-slate-900">
                                {(detail?.title ?? item.title) || "Solicitud"}
                              </h3>
                              <p className="text-xs text-slate-500">
                                {(detail?.city ?? item.city) || "Sin ciudad"} -{" "}
                                {statusLabel(detail?.status ?? item.status)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                onClick={() => handleSave(item.id)}
                                title="Guardar"
                                aria-label="Guardar"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleCancel(item.id)}
                                title="Cerrar"
                                aria-label="Cerrar"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                onClick={() => handleDelete(item.id)}
                                title="Eliminar"
                                aria-label="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {loadingDetail === item.id && !detail ? (
                            <div className="px-2 py-4 text-sm text-slate-500">
                              Cargando detalle...
                            </div>
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
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
              {isMy ? (
                <div className="space-y-2">
                  <p className="font-medium text-slate-700">
                    Aun no tienes solicitudes.
                  </p>
                  <p>
                    Crea una solicitud para recibir propuestas de profesionales.
                  </p>
                  <CreateRequestButton variant="outline">
                    Crear nueva solicitud
                  </CreateRequestButton>
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

function getDateMs(item: RequestItem): number {
  const value = item.updated_at || item.created_at;
  if (!value) return 0;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function statusRank(status?: string | null): number {
  const key = (status ?? "").toLowerCase();
  if (
    ["in_process", "scheduled", "paid", "accepted", "in_progress"].includes(key)
  )
    return 0;
  if (["active", "open", "activa"].includes(key)) return 1;
  if (["completed", "finished", "finalizada"].includes(key)) return 2;
  if (
    ["cancelled", "canceled", "deleted", "cancelada", "eliminada"].includes(key)
  )
    return 3;
  return 99;
}
