"use client";

import * as React from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StatusMultiSelect from "@/components/filters/StatusMultiSelect";
import CreateRequestButton from "@/components/requests/CreateRequestButton";
import { CITIES } from "@/lib/cities";
import { normalizeAppError } from "@/lib/errors/app-error";
import { reportError } from "@/lib/errors/report-error";
import { formatCurrencyMXN } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "@/components/ui/use-toast";

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
  attachments?: Array<{
    url?: string | null;
    path?: string | null;
    mime?: string | null;
    size?: number | null;
  }> | null;
  photos?: Array<{ url?: string | null }> | null;
};

type Attachment = {
  url?: string;
  path?: string;
  mime: string;
  size: number;
};

type Draft = {
  title: string;
  city: string;
  required_at: string;
  category: string;
  subcategory: string;
  budget: string;
  attachments: Attachment[];
};

type CatalogSub = { name: string; icon?: string | null };

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
const REQUESTS_PAGE_SIZE = 12;

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

function toDateInput(value?: string | null): string {
  if (!value) return "";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function extractAttachments(item: RequestItem): Attachment[] {
  const out: Attachment[] = [];
  if (Array.isArray(item.attachments)) {
    for (const a of item.attachments) {
      const url = (a?.url || "").trim();
      if (!url) continue;
      out.push({
        url,
        path: (a?.path || "").trim() || undefined,
        mime: (a?.mime || "image/*").trim() || "image/*",
        size: typeof a?.size === "number" ? a.size : Number(a?.size || 0),
      });
    }
  }
  if (out.length === 0 && Array.isArray(item.photos)) {
    for (const p of item.photos) {
      const url = (p?.url || "").trim();
      if (!url) continue;
      out.push({ url, mime: "image/*", size: 0 });
    }
  }
  return out.slice(0, 5);
}

function getBudget(item: RequestItem): number | null {
  if (typeof item.estimated_budget === "number") return item.estimated_budget;
  if (typeof item.budget === "number") return item.budget;
  return null;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 25000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
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
  const [currentPage, setCurrentPage] = React.useState(1);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [savingById, setSavingById] = React.useState<Record<string, boolean>>(
    {},
  );
  const [uploadingById, setUploadingById] = React.useState<
    Record<string, boolean>
  >({});
  const [uploadErrorById, setUploadErrorById] = React.useState<
    Record<string, string | null>
  >({});
  const [deletingById, setDeletingById] = React.useState<
    Record<string, boolean>
  >({});
  const [catOptions, setCatOptions] = React.useState<string[]>([]);
  const [subOptions, setSubOptions] = React.useState<
    Record<string, CatalogSub[]>
  >({});

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
      qs.set("limit", "100");

      const allItems: RequestItem[] = [];
      const seenIds = new Set<string>();
      let cursor: string | null = null;
      let guard = 0;

      do {
        const pageQs = new URLSearchParams(qs.toString());
        if (cursor) {
          pageQs.set("cursor", cursor);
          pageQs.set("dir", "next");
        }

        const res = await fetch(
          `/api/requests${pageQs.toString() ? `?${pageQs.toString()}` : ""}`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw {
            message: json?.error || "REQUESTS_LIST_FAILED",
            detail: json?.detail || null,
            status: res.status,
          };
        }

        const pageData = Array.isArray(json?.data)
          ? (json.data as RequestItem[])
          : [];
        for (const item of pageData) {
          if (!item?.id || seenIds.has(item.id)) continue;
          seenIds.add(item.id);
          allItems.push(item);
        }

        cursor =
          typeof json?.nextCursor === "string" && json.nextCursor.length > 0
            ? json.nextCursor
            : null;
        guard += 1;
      } while (cursor && guard < 20);

      setItems(allItems);
    } catch (e) {
      const normalized = normalizeAppError(e, {
        source: "requests.list",
      });
      setError("No pudimos cargar tus solicitudes. Intenta de nuevo.");
      if (
        normalized.code === "AUTH_SESSION_INVALID" ||
        normalized.code === "AUTH_REQUIRED" ||
        normalized.code === "PROFILE_INCONSISTENT"
      ) {
        const next = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
        router.replace(`/auth/sign-in?next=${encodeURIComponent(next)}`);
      }
      reportError({
        error: e,
        normalized,
        area: "requests",
        feature: "requests-mine-list",
        route: "/requests?mine=1",
        blocking: true,
      });
    } finally {
      setLoading(false);
    }
  }, [status, city, isMy, pathname, router, searchParams]);

  React.useEffect(() => {
    void fetchList();
  }, [fetchList]);

  React.useEffect(() => {
    if (!isMy) return;
    const supabase = supabaseBrowser;
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!mounted) return;
        void fetchList();
      }, 250);
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!mounted || !uid) return;
      channel = supabase
        .channel(`requests-mine:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "requests",
            filter: `created_by=eq.${uid}`,
          },
          scheduleRefresh,
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetchList, isMy]);

  React.useEffect(() => {
    if (!isMy) return;
    const hasStatus = typeof status === "string" && status.trim().length > 0;
    if (!hasStatus) {
      updateSearch({ status: "active,in_process", mine: "1" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMy]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/catalog/categories", {
          cache: "no-store",
        });
        const j = await res.json().catch(() => ({}));
        if (!alive || !res.ok || !j?.ok || !Array.isArray(j?.data)) return;
        const cats = new Map<string, Map<string, CatalogSub>>();
        for (const row of j.data as Array<{
          category?: string;
          subcategory?: string | null;
          icon?: string | null;
        }>) {
          const c = String(row.category || "").trim();
          const s = String(row.subcategory || "").trim();
          if (!c) continue;
          if (!cats.has(c)) cats.set(c, new Map());
          if (s) cats.get(c)!.set(s, { name: s, icon: row.icon || null });
        }
        const nextCats = Array.from(cats.keys()).sort((a, b) =>
          a.localeCompare(b, "es"),
        );
        const nextSubs: Record<string, CatalogSub[]> = {};
        for (const [categoryName, subs] of cats.entries()) {
          nextSubs[categoryName] = Array.from(subs.values()).sort((a, b) =>
            a.name.localeCompare(b.name, "es"),
          );
        }
        setCatOptions(nextCats);
        setSubOptions(nextSubs);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  const totalPages = React.useMemo(
    () => Math.max(1, Math.ceil(sortedItems.length / REQUESTS_PAGE_SIZE)),
    [sortedItems.length],
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [status, city, mine, sort, query]);

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedItems = React.useMemo(() => {
    const from = (currentPage - 1) * REQUESTS_PAGE_SIZE;
    return sortedItems.slice(from, from + REQUESTS_PAGE_SIZE);
  }, [currentPage, sortedItems]);

  function updateSearch(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    Object.entries(next).forEach(([key, value]) => {
      if (value && value.length > 0) params.set(key, value);
      else params.delete(key);
    });
    router.replace(`${pathname}?${params.toString()}`);
  }

  function buildDraft(item: RequestItem): Draft {
    return {
      title: item.title ?? "",
      city: item.city ?? "",
      required_at: toDateInput(item.required_at),
      category: item.category ?? "",
      subcategory: extractSubcategory(item) ?? "",
      budget:
        typeof getBudget(item) === "number" ? String(getBudget(item)) : "",
      attachments: extractAttachments(item),
    };
  }

  function startEditing(item: RequestItem) {
    setEditingId(item.id);
    setUploadErrorById((prev) => ({ ...prev, [item.id]: null }));
    setDrafts((prev) => ({
      ...prev,
      [item.id]: prev[item.id] ?? buildDraft(item),
    }));
  }

  function cancelEditing(itemId: string) {
    setEditingId(null);
    setUploadErrorById((prev) => ({ ...prev, [itemId]: null }));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  function setDraft(itemId: string, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return {
        ...prev,
        [itemId]: { ...current, ...patch },
      };
    });
  }

  function removeAttachment(itemId: string, index: number) {
    const draft = drafts[itemId];
    if (!draft) return;
    const next = draft.attachments.filter((_, i) => i !== index);
    setDraft(itemId, { attachments: next });
  }

  function setCover(itemId: string, index: number) {
    const draft = drafts[itemId];
    if (!draft) return;
    if (index <= 0 || index >= draft.attachments.length) return;
    const selected = draft.attachments[index];
    const rest = draft.attachments.filter((_, i) => i !== index);
    setDraft(itemId, { attachments: [selected, ...rest] });
  }

  async function addFiles(item: RequestItem, files: FileList | null) {
    const itemId = item.id;
    const selectedFiles = files ? Array.from(files) : [];
    if (selectedFiles.length === 0) return;
    setUploadErrorById((prev) => ({ ...prev, [itemId]: null }));
    setUploadingById((prev) => ({ ...prev, [itemId]: true }));

    try {
      await fetchWithTimeout(
        "/api/storage/ensure?b=requests",
        { method: "POST" },
        15000,
      ).catch(() => undefined);

      const meRes = await fetchWithTimeout("/api/me", {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
      }).catch(() => null);
      let currentUserId: string | null = null;
      if (meRes) {
        const meJson = await meRes.json().catch(() => ({}));
        currentUserId = meRes.ok
          ? ((meJson?.user?.id as string | undefined) ?? null)
          : null;
      }
      const prefix = currentUserId ?? "anon";

      const baseDraft = drafts[itemId] ?? buildDraft(item);
      if (!drafts[itemId]) {
        setDrafts((prev) => ({ ...prev, [itemId]: baseDraft }));
      }
      const initialCount = baseDraft.attachments.length;
      const next: Attachment[] = [...baseDraft.attachments];
      for (const f of selectedFiles) {
        if (next.length >= 5) break;
        const max = 5 * 1024 * 1024;
        if (f.size > max) throw new Error(`El archivo ${f.name} excede 5MB`);
        if (!/^image\//i.test(f.type))
          throw new Error(`Tipo invalido para ${f.name}`);

        const path = `${prefix}/${Date.now()}-${encodeURIComponent(f.name)}`;
        let uploadedUrl: string | null = null;

        // Prefer server-side upload path (service role) for reliability in client flows.
        try {
          const fd = new FormData();
          fd.append("file", f);
          fd.append("path", path);
          fd.append("bucket", "requests");
          const r = await fetchWithTimeout(
            "/api/storage/upload",
            {
              method: "POST",
              body: fd,
            },
            30000,
          );
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j?.ok) throw new Error(j?.error || "upload_failed");
          uploadedUrl =
            typeof j?.url === "string" && j.url.trim().length > 0
              ? j.url.trim()
              : null;
        } catch {
          const up = await Promise.race([
            supabaseBrowser.storage
              .from("requests")
              .upload(path, f, { contentType: f.type, upsert: false }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("upload_timeout")), 30000),
            ),
          ]).catch((e) => {
            throw e;
          });
          if (up && typeof up === "object" && "error" in up && up.error) {
            throw up.error;
          }
          const pub = supabaseBrowser.storage
            .from("requests")
            .getPublicUrl(path);
          uploadedUrl = pub.data.publicUrl?.trim() || null;
        }
        if (!uploadedUrl)
          throw new Error(`No se pudo obtener URL para ${f.name}`);

        next.push({
          url: uploadedUrl || undefined,
          path,
          mime: f.type || "image/*",
          size: f.size,
        });
      }
      setDrafts((prev) => {
        const current = prev[itemId] ?? baseDraft;
        return {
          ...prev,
          [itemId]: {
            ...current,
            attachments: next.slice(0, 5),
          },
        };
      });
      const addedCount = Math.max(0, Math.min(5, next.length) - initialCount);
      toast("Imagenes agregadas", {
        description: `${addedCount} archivo(s) listos para guardar`,
      });
    } catch (e) {
      const normalized = normalizeAppError(e, {
        source: "requests.attachments.upload",
      });
      const message = e instanceof Error ? e.message : String(e);
      const friendly =
        message === "upload_timeout" || message.includes("aborted")
          ? "El upload tardo demasiado. Intenta de nuevo."
          : normalized.userMessage;
      setError(friendly);
      setUploadErrorById((prev) => ({ ...prev, [itemId]: friendly }));
      toast("No se pudo subir la imagen", { description: friendly });
      reportError({
        error: e,
        normalized,
        area: "requests",
        feature: "upload-attachments",
        route: "/requests",
        blocking: false,
        extra: { requestId: itemId },
      });
    } finally {
      setUploadingById((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  async function saveEdit(itemId: string) {
    const draft = drafts[itemId];
    if (!draft) return;

    setSavingById((prev) => ({ ...prev, [itemId]: true }));
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: draft.title || undefined,
        city: draft.city || undefined,
        category: draft.category || undefined,
        subcategories: draft.subcategory ? [draft.subcategory] : undefined,
        budget: draft.budget ? Number(draft.budget) : null,
        required_at: draft.required_at
          ? new Date(`${draft.required_at}T00:00:00.000Z`).toISOString()
          : undefined,
        attachments: draft.attachments
          .filter(
            (a) =>
              (typeof a.url === "string" && a.url.trim().length > 0) ||
              (typeof a.path === "string" && a.path.trim().length > 0),
          )
          .map((a) => ({
            ...(a.url ? { url: a.url } : {}),
            ...(a.path ? { path: a.path } : {}),
            mime: a.mime || "image/*",
            size: Number.isFinite(a.size) ? a.size : 0,
          })),
      };

      const res = await fetch(`/api/requests/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw {
          message: json?.error || "REQUEST_UPDATE_FAILED",
          detail: json?.detail || null,
          status: res.status,
        };
      }

      setUploadErrorById((prev) => ({ ...prev, [itemId]: null }));
      toast("Solicitud actualizada");
      cancelEditing(itemId);
      await fetchList();
    } catch (e) {
      const normalized = normalizeAppError(e, {
        source: "requests.update",
      });
      const userMessage = "No pudimos guardar los cambios. Intenta de nuevo.";
      setError(userMessage);
      toast("No se pudo guardar", { description: userMessage });
      reportError({
        error: e,
        normalized,
        area: "requests",
        feature: "edit-request",
        route: "/requests",
        blocking: true,
        extra: { requestId: itemId },
      });
    } finally {
      setSavingById((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  async function deleteRequest(itemId: string) {
    setDeletingById((prev) => ({ ...prev, [itemId]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/requests/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw {
          message: json?.error || "REQUEST_DELETE_FAILED",
          detail: json?.detail || null,
          status: res.status,
        };
      }
      if (editingId === itemId) cancelEditing(itemId);
      await fetchList();
    } catch (e) {
      const normalized = normalizeAppError(e, {
        source: "requests.delete",
      });
      const userMessage = "No pudimos eliminar la solicitud. Intenta de nuevo.";
      setError(userMessage);
      toast("No se pudo eliminar", { description: userMessage });
      reportError({
        error: e,
        normalized,
        area: "requests",
        feature: "delete-request",
        route: "/requests",
        blocking: true,
        extra: { requestId: itemId },
      });
    } finally {
      setDeletingById((prev) => ({ ...prev, [itemId]: false }));
    }
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
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error ? (
        <div>
          {sortedItems.length ? (
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {pagedItems.map((item) => {
                const isEditing = editingId === item.id;
                const draft = drafts[item.id];
                const ui = statusUi(item.status);
                const imageList =
                  isEditing && draft
                    ? draft.attachments
                    : extractAttachments(item);
                const icon = resolvePlaceholderIcon(
                  isEditing && draft
                    ? {
                        category: draft.category,
                        subcategory: draft.subcategory,
                        subcategories: [draft.subcategory],
                      }
                    : item,
                );
                const categoryLabel = simplifyCategory(
                  isEditing && draft
                    ? {
                        category: draft.category,
                        subcategory: draft.subcategory,
                        subcategories: [draft.subcategory],
                      }
                    : item,
                );
                const showBudget = isEditing
                  ? draft?.budget
                    ? formatCurrencyMXN(Number(draft.budget))
                    : "Sin definir"
                  : typeof getBudget(item) === "number"
                    ? formatCurrencyMXN(getBudget(item) as number)
                    : "Sin definir";
                const saving = !!savingById[item.id];
                const deleting = !!deletingById[item.id];
                const uploading = !!uploadingById[item.id];
                const uploadError = uploadErrorById[item.id];

                return (
                  <li key={item.id} className="h-full">
                    <article
                      className={[
                        "flex h-full flex-col overflow-hidden rounded-2xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                        ui.cardClass,
                      ].join(" ")}
                    >
                      {!isEditing ? (
                        <Link href={`/requests/${item.id}`} className="block">
                          {imageList.length > 0 ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageList[0].url || ""}
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
                      ) : (
                        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
                          {imageList.length > 0 ? (
                            <div className="flex h-full gap-2 overflow-x-auto px-2 py-2 pr-12">
                              {imageList.map((att, index) => (
                                <div
                                  key={`${att.url || att.path || "photo"}-${index}`}
                                  className="group relative h-full w-20 shrink-0 overflow-hidden rounded-md border border-white/70 bg-slate-200"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={att.url || ""}
                                    alt="Foto"
                                    className="h-full w-full object-cover"
                                  />
                                  {index === 0 ? (
                                    <span className="absolute left-1 top-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-white">
                                      Portada
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeAttachment(item.id, index)
                                    }
                                    className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                                    aria-label="Eliminar foto"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                  {index > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setCover(item.id, index)}
                                      className="absolute inset-x-1 bottom-1 rounded bg-black/55 px-1.5 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                      Seleccionar como portada
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {imageList.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
                              {React.createElement(icon, {
                                className:
                                  icon === SecurityBadgeIcon
                                    ? "h-10 w-10 text-slate-400"
                                    : "h-9 w-9 text-slate-400",
                              })}
                              <label className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white/95 px-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-white">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => {
                                    void addFiles(item, e.target.files);
                                    e.currentTarget.value = "";
                                  }}
                                />
                                Agregar imagenes
                              </label>
                            </div>
                          ) : null}
                          {imageList.length > 0 && imageList.length < 5 ? (
                            <label className="absolute right-2 top-1/2 inline-flex h-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-white/80 bg-white/95 px-2.5 text-[11px] font-medium text-slate-700 shadow hover:bg-white">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  void addFiles(item, e.target.files);
                                  e.currentTarget.value = "";
                                }}
                              />
                              + Agregar
                            </label>
                          ) : null}
                          {uploading ? (
                            <div className="absolute bottom-1 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                              Subiendo...
                            </div>
                          ) : null}
                          {uploadError ? (
                            <div className="absolute bottom-1 right-2 max-w-[70%] truncate rounded bg-red-600/85 px-1.5 py-0.5 text-[10px] text-white">
                              {uploadError}
                            </div>
                          ) : null}
                        </div>
                      )}

                      <div className="flex min-w-0 flex-1 flex-col p-3.5">
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                          <span
                            className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ui.badgeClass}`}
                          >
                            {ui.label}
                          </span>
                          {isMy ? (
                            !isEditing ? (
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => startEditing(item)}
                                aria-label="Editar solicitud"
                                className="h-8 w-8 rounded-lg"
                              >
                                <SquarePen className="h-4 w-4" />
                              </Button>
                            ) : (
                              <div className="flex shrink-0 items-center gap-1.5">
                                <Button
                                  size="icon"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => void saveEdit(item.id)}
                                  disabled={saving}
                                  aria-label="Guardar"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => cancelEditing(item.id)}
                                  aria-label="Cancelar"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => void deleteRequest(item.id)}
                                  disabled={deleting}
                                  aria-label="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )
                          ) : null}
                        </div>

                        {isEditing && draft ? (
                          <Input
                            value={draft.title}
                            onChange={(e) =>
                              setDraft(item.id, { title: e.target.value })
                            }
                            className="h-8 w-full min-w-0 max-w-full text-sm"
                            placeholder="Titulo"
                          />
                        ) : (
                          <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-5 text-slate-900">
                            {item.title ?? "Solicitud"}
                          </h3>
                        )}

                        <div className="mt-3 space-y-0.5">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Presupuesto estimado
                          </p>
                          {isEditing && draft ? (
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={draft.budget}
                              onChange={(e) =>
                                setDraft(item.id, { budget: e.target.value })
                              }
                              className="h-8 w-full min-w-0 max-w-full text-sm"
                              placeholder="Sin definir"
                            />
                          ) : null}
                          {!isEditing ? (
                            <p className="text-base font-semibold text-slate-900">
                              {showBudget}
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-y-2 text-xs text-slate-600">
                          <div className="flex min-w-0 items-start gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-500" />
                            {isEditing && draft ? (
                              <div className="min-w-0 flex-1">
                                <Select
                                  value={draft.city || undefined}
                                  onValueChange={(value) =>
                                    setDraft(item.id, { city: value })
                                  }
                                >
                                  <SelectTrigger className="h-7 min-h-7 w-full min-w-0 max-w-full text-xs">
                                    <SelectValue placeholder="Ciudad" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {draft.city &&
                                    !(CITIES as readonly string[]).includes(
                                      draft.city,
                                    ) ? (
                                      <SelectItem value={draft.city}>
                                        {draft.city}
                                      </SelectItem>
                                    ) : null}
                                    {CITIES.map((c) => (
                                      <SelectItem key={c} value={c}>
                                        {c}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <span className="min-w-0 truncate">
                                {item.city || "Ciudad no definida"}
                              </span>
                            )}
                          </div>
                          <p className="flex min-w-0 items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            <span className="min-w-0 truncate">
                              Creada: {formatDate(item.created_at)}
                            </span>
                          </p>
                          <div className="flex min-w-0 items-start gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
                            {isEditing && draft ? (
                              <Input
                                type="date"
                                value={draft.required_at}
                                onChange={(e) =>
                                  setDraft(item.id, {
                                    required_at: e.target.value,
                                  })
                                }
                                className="h-7 w-full min-w-0 max-w-full text-xs"
                              />
                            ) : (
                              <span className="min-w-0 truncate">
                                Requerida: {formatDate(item.required_at)}
                              </span>
                            )}
                          </div>
                          {!isEditing ? (
                            <div>
                              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                <Tag className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {categoryLabel}
                                </span>
                              </span>
                            </div>
                          ) : draft ? (
                            <div className="grid min-w-0 grid-cols-1 gap-1.5">
                              <Select
                                value={draft.category || undefined}
                                onValueChange={(value) => {
                                  const subs = subOptions[value] || [];
                                  const keepsCurrent = subs.some(
                                    (s) => s.name === draft.subcategory,
                                  );
                                  setDraft(item.id, {
                                    category: value,
                                    subcategory: keepsCurrent
                                      ? draft.subcategory
                                      : subs[0]?.name || "",
                                  });
                                }}
                              >
                                <SelectTrigger className="h-7 min-h-7 w-full min-w-0 max-w-full text-xs">
                                  <SelectValue placeholder="Categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                  {catOptions.map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={draft.subcategory || undefined}
                                onValueChange={(value) =>
                                  setDraft(item.id, { subcategory: value })
                                }
                                disabled={!draft.category}
                              >
                                <SelectTrigger className="h-7 min-h-7 w-full min-w-0 max-w-full text-xs">
                                  <SelectValue placeholder="Subcategoria" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(subOptions[draft.category] || []).map(
                                    (sub) => (
                                      <SelectItem
                                        key={sub.name}
                                        value={sub.name}
                                      >
                                        <span className="inline-flex items-center gap-1.5">
                                          {sub.icon ? (
                                            sub.icon.startsWith("http") ? (
                                              // eslint-disable-next-line @next/next/no-img-element
                                              <img
                                                src={sub.icon}
                                                alt=""
                                                className="h-3.5 w-3.5 object-contain"
                                              />
                                            ) : (
                                              <span className="text-xs">
                                                {sub.icon}
                                              </span>
                                            )
                                          ) : null}
                                          <span>{sub.name}</span>
                                        </span>
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}
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
          {sortedItems.length ? (
            <div className="mt-4 flex justify-center">
              <div className="w-full max-w-xs">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage <= 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 flex-1 cursor-default justify-center rounded-lg text-center"
                    disabled
                  >
                    Página {currentPage} de {totalPages}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage >= totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
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
