"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  BriefcaseBusiness,
  Calendar,
  CalendarClock,
  Car,
  ChevronRight,
  Droplets,
  Hammer,
  Home,
  KeyRound,
  Leaf,
  MapPin,
  Paintbrush,
  PawPrint,
  Plug,
  Sparkles,
  Tag,
  Truck,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";

import { formatCurrencyMXN } from "@/lib/format";

function SecurityCapIcon({ className }: { className?: string }) {
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

type Request = {
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
};

function extractThumb(att?: unknown): string | null {
  const list = att as unknown[];
  if (!Array.isArray(list)) return null;
  const first = list.find(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).url === "string",
  ) as Record<string, unknown> | undefined;
  const src = typeof first?.url === "string" ? first.url.trim() : "";
  return src.length > 0 ? src : null;
}

function formatDMYShort(input?: string | null): string {
  if (!input) return "No definida";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "No definida";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(d);
  } catch {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }
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

function simplifyCategory(
  category?: string | null,
  subcategory?: string | null,
): string {
  const cat = cleanToken(category);
  const sub = cleanToken(subcategory);
  if (!cat && !sub) return "Sin categoria";
  if (!sub) return cat;
  if (!cat) return sub;
  if (cat.toLowerCase().includes(sub.toLowerCase())) return sub;
  if (sub.toLowerCase().includes(cat.toLowerCase())) return cat;
  return sub.length <= cat.length ? sub : cat;
}

function parseHexColor(color?: string | null): [number, number, number] | null {
  if (!color) return null;
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) return null;
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => `${c}${c}`)
          .join("")
      : hex;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return [r, g, b];
}

function parseRgbColor(color?: string | null): [number, number, number] | null {
  if (!color) return null;
  const match = color
    .trim()
    .match(/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})/i);
  if (!match) return null;
  const r = Math.min(255, Math.max(0, Number(match[1])));
  const g = Math.min(255, Math.max(0, Number(match[2])));
  const b = Math.min(255, Math.max(0, Number(match[3])));
  return [r, g, b];
}

function parseColor(color?: string | null): [number, number, number] | null {
  return parseHexColor(color) || parseRgbColor(color);
}

function rgba(color: string, alpha: number): string | null {
  const rgb = parseColor(color);
  if (!rgb) return null;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

type IconResolved = {
  type: "vector";
  Icon: ComponentType<{ className?: string }>;
};

function resolvePlaceholderIcon(
  label: string,
  hint?: string | null,
): IconResolved {
  const hintText = normalizeText(hint);
  const key = normalizeText(label);
  const source = `${hintText} ${key}`;

  if (
    source.includes("plomer") ||
    source.includes("fuga") ||
    source.includes("tuber") ||
    source.includes("agua")
  ) {
    return { type: "vector", Icon: Droplets };
  }
  if (
    source.includes("electric") ||
    source.includes("electri") ||
    source.includes("volt") ||
    source.includes("bolt")
  ) {
    return { type: "vector", Icon: Zap };
  }
  if (
    source.includes("instal") ||
    source.includes("manten") ||
    source.includes("repar") ||
    source.includes("tool")
  ) {
    return { type: "vector", Icon: Wrench };
  }
  if (source.includes("limpieza") || source.includes("aseo")) {
    return { type: "vector", Icon: Sparkles };
  }
  if (
    source.includes("jardin") ||
    source.includes("pasto") ||
    source.includes("podar")
  ) {
    return { type: "vector", Icon: Leaf };
  }
  if (source.includes("pint")) {
    return { type: "vector", Icon: Paintbrush };
  }
  if (
    source.includes("piso") ||
    source.includes("loseta") ||
    source.includes("azulejo") ||
    source.includes("porcelanato") ||
    source.includes("duela") ||
    source.includes("laminado") ||
    source.includes("vinil")
  ) {
    return { type: "vector", Icon: MosaicIcon };
  }
  if (
    source.includes("carpinter") ||
    source.includes("mueble") ||
    source.includes("ebanist")
  ) {
    return { type: "vector", Icon: Hammer };
  }
  if (
    source.includes("mascota") ||
    source.includes("veter") ||
    source.includes("pet")
  ) {
    return { type: "vector", Icon: PawPrint };
  }
  if (
    source.includes("transporte") ||
    source.includes("carga") ||
    source.includes("mudanza") ||
    source.includes("flete")
  ) {
    return { type: "vector", Icon: Truck };
  }
  if (
    source.includes("seguridad") ||
    source.includes("guardia") ||
    source.includes("vigilancia")
  ) {
    return { type: "vector", Icon: SecurityCapIcon };
  }
  if (source.includes("cerra") || source.includes("llave")) {
    return { type: "vector", Icon: KeyRound };
  }
  if (
    source.includes("aire") ||
    source.includes("clima") ||
    source.includes("ventila")
  ) {
    return { type: "vector", Icon: Wind };
  }
  if (
    source.includes("electrodom") ||
    source.includes("refriger") ||
    source.includes("lavadora") ||
    source.includes("secadora") ||
    source.includes("microondas")
  ) {
    return { type: "vector", Icon: Plug };
  }
  if (
    source.includes("constru") ||
    source.includes("alban") ||
    source.includes("obra")
  ) {
    return { type: "vector", Icon: Hammer };
  }
  if (source.includes("hogar") || source.includes("casa")) {
    return { type: "vector", Icon: Home };
  }
  if (source.includes("auto") || source.includes("vehiculo")) {
    return { type: "vector", Icon: Car };
  }
  return { type: "vector", Icon: BriefcaseBusiness };
}

export default function RequestCard({
  request,
  subcategoryIconMap = {},
  categoryIconMap = {},
  subcategoryColorMap = {},
  categoryColorMap = {},
}: {
  request: Request;
  subcategoryIconMap?: Record<string, string>;
  categoryIconMap?: Record<string, string>;
  subcategoryColorMap?: Record<string, string>;
  categoryColorMap?: Record<string, string>;
}) {
  const thumb = extractThumb(request.attachments);
  const amount =
    typeof request.estimated_budget === "number"
      ? request.estimated_budget
      : typeof request.budget === "number"
        ? request.budget
        : null;
  const primaryCategory = simplifyCategory(
    request.category,
    request.subcategory,
  );
  const normalizedSub = normalizeText(request.subcategory);
  const normalizedCat = normalizeText(request.category);
  const iconHint =
    subcategoryIconMap[normalizedSub] || categoryIconMap[normalizedCat] || null;
  const colorHint =
    subcategoryColorMap[normalizedSub] ||
    categoryColorMap[normalizedCat] ||
    null;
  const resolvedIcon = normalizedCat.includes("jardineria y exterior")
    ? ({ type: "vector", Icon: Leaf } as const)
    : resolvePlaceholderIcon(primaryCategory, iconHint);

  const chipBackground = colorHint ? rgba(colorHint, 0.12) : null;
  const chipBorder = colorHint ? rgba(colorHint, 0.22) : null;
  const chipText = colorHint || null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/requests/explore/${request.id}`} className="block">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={request.title}
            className="h-32 w-full object-cover"
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
            <resolvedIcon.Icon
              className={
                resolvedIcon.Icon === SecurityCapIcon
                  ? "h-10 w-10 text-slate-400"
                  : "h-9 w-9 text-slate-400"
              }
            />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3.5">
        <Link href={`/requests/explore/${request.id}`} className="space-y-3">
          <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-5 text-slate-900">
            {request.title}
          </h3>

          <div className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Presupuesto estimado
            </p>
            <p className="text-base font-semibold text-slate-900">
              {typeof amount === "number"
                ? formatCurrencyMXN(amount)
                : "Sin definir"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-y-2 text-xs text-slate-600">
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              <span className="truncate">
                {request.city || "Ciudad no definida"}
              </span>
            </p>
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>Creada: {formatDMYShort(request.created_at)}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
              <span>Requerida: {formatDMYShort(request.required_at)}</span>
            </p>
            <div>
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                style={
                  chipText
                    ? {
                        backgroundColor: chipBackground ?? undefined,
                        borderColor: chipBorder ?? undefined,
                        color: chipText,
                      }
                    : undefined
                }
              >
                <Tag className="h-3 w-3 shrink-0" />
                <span className="truncate">{primaryCategory}</span>
              </span>
            </div>
          </div>
        </Link>

        <Link
          href={`/requests/explore/${request.id}`}
          className="mt-4 inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:border-brand hover:bg-brand hover:text-white"
        >
          Ver solicitud
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
