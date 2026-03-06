"use client";

import Link from "next/link";
import { Calendar, CalendarClock, MapPin, Tag, Wallet } from "lucide-react";

import FavoriteButton from "@/components/explore/FavoriteButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { normalizeAvatarUrl } from "@/lib/avatar";
import { formatCurrencyMXN } from "@/lib/format";

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
  client_name?: string | null;
  client_avatar_url?: string | null;
  is_favorite?: boolean;
};

const DEFAULT_REQUEST_IMAGE = "/images/default-requests-image.png";

function extractThumb(att?: unknown): string | null {
  const a = att as unknown[];
  if (!Array.isArray(a)) return null;
  const first = a.find(
    (x) => x && typeof x === "object" && (x as Record<string, unknown>).url,
  );
  if (!first) return null;
  const raw = (first as Record<string, unknown>).url as unknown;
  const src = typeof raw === "string" ? raw : String(raw ?? "");
  return src.trim().length > 0 ? src.trim() : null;
}

function formatDMYShort(input?: string | null): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
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

function initials(name?: string | null): string {
  const raw = String(name || "Cliente").trim();
  if (!raw) return "CL";
  const parts = raw.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "C";
  const second = parts[1]?.[0] || parts[0]?.[1] || "L";
  return `${first}${second}`.toUpperCase();
}

export default function RequestCard({
  proId,
  request,
  onFavoriteToggled,
  subcategoryIconMap = {},
}: {
  proId: string;
  request: Request;
  onFavoriteToggled?: (id: string, fav: boolean) => void;
  subcategoryIconMap?: Record<string, string>;
}) {
  const thumb = extractThumb(request.attachments) || DEFAULT_REQUEST_IMAGE;
  const amount =
    typeof request.estimated_budget === "number"
      ? request.estimated_budget
      : typeof request.budget === "number"
        ? request.budget
        : null;
  const clientName = request.client_name?.trim() || "Cliente";
  const avatarSrc = normalizeAvatarUrl(request.client_avatar_url) || undefined;
  const categoryLabel = [request.category, request.subcategory]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join(" · ");
  const subcategoryIcon = request.subcategory
    ? subcategoryIconMap[String(request.subcategory).toLowerCase()] || ""
    : "";

  return (
    <article className="overflow-hidden rounded-2xl border bg-white transition hover:shadow-sm">
      <Link href={`/requests/explore/${request.id}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={request.title}
          className="h-40 w-full object-cover"
        />
      </Link>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/requests/explore/${request.id}`}
            className="flex min-w-0 items-center gap-2"
          >
            <Avatar className="h-8 w-8 border">
              {avatarSrc ? (
                <AvatarImage src={avatarSrc} alt={clientName} />
              ) : null}
              <AvatarFallback>{initials(clientName)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium text-slate-800">
              {clientName}
            </span>
          </Link>
          <FavoriteButton
            proId={proId}
            requestId={request.id}
            initial={!!request.is_favorite}
            onToggled={(fav) => onFavoriteToggled?.(request.id, fav)}
          />
        </div>

        <Link
          href={`/requests/explore/${request.id}`}
          className="block space-y-3"
        >
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">
            {request.title}
          </h3>

          <div className="grid grid-cols-1 gap-2 text-xs text-slate-600">
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              <span>{request.city || "—"}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-slate-500" />
              <span>
                {typeof amount === "number" ? formatCurrencyMXN(amount) : "—"}
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
            <p className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-slate-500" />
              <span className="truncate" title={categoryLabel || undefined}>
                {subcategoryIcon ? `${subcategoryIcon} ` : ""}
                {categoryLabel || "—"}
              </span>
            </p>
          </div>
        </Link>
      </div>
    </article>
  );
}
