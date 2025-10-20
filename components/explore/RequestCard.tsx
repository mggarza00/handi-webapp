"use client";

import * as React from "react";
import Link from "next/link";

import FavoriteButton from "@/components/explore/FavoriteButton";
import { formatCurrencyMXN } from "@/lib/format";

type Request = {
  id: string;
  title: string;
  city: string | null;
  required_at?: string | null;
  estimated_budget?: number | null;
  budget?: number | null;
  attachments?: unknown;
  is_favorite?: boolean;
};

const DEFAULT_REQUEST_IMAGE = "/images/default-requests-image.png";

function extractThumb(att?: unknown): string | null {
  const a = att as unknown[];
  if (Array.isArray(a)) {
    const first = a.find((x) => x && typeof x === "object" && (x as Record<string, unknown>).url);
    if (first) {
      const raw = (first as Record<string, unknown>).url as unknown;
      const s = typeof raw === "string" ? raw : String(raw ?? "");
      return s.trim().length > 0 ? s.trim() : null;
    }
  }
  return null;
}

function formatDateShort(input?: string | null): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input).slice(0, 10);
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(d);
}

export default function RequestCard({
  proId,
  request,
  onFavoriteToggled,
}: {
  proId: string;
  request: Request;
  onFavoriteToggled?: (id: string, fav: boolean) => void;
}) {
  const thumb = extractThumb(request.attachments) || DEFAULT_REQUEST_IMAGE;
  const amount =
    typeof request.estimated_budget === "number"
      ? request.estimated_budget
      : typeof request.budget === "number"
        ? request.budget
        : null;

  function formatDMYShort(input?: string | null): string {
    if (!input) return "";
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "";
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

  return (
    <div className="rounded-2xl border p-3 hover:bg-slate-50 transition">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt={request.title} className="h-16 w-16 rounded-md object-cover border" />
        <div className="flex-1 min-w-0">
          <Link href={`/requests/explore/${request.id}`} className="block">
            <p className="font-medium truncate text-slate-900">{request.title}</p>
            <div className="text-xs text-muted-foreground">
              {[
                request.city ?? "—",
                formatDMYShort(request.required_at),
                typeof amount === "number" ? formatCurrencyMXN(amount) : "",
              ]
                .filter((s) => typeof s === "string" && s.length > 0)
                .join(" - ")}
            </div>
          </Link>
        </div>
        <div className="ml-auto shrink-0">
          <FavoriteButton
            proId={proId}
            requestId={request.id}
            initial={!!request.is_favorite}
            onToggled={(fav) => onFavoriteToggled?.(request.id, fav)}
          />
        </div>
      </div>
    </div>
  );
}
