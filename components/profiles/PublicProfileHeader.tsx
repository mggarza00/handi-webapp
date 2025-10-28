import * as React from "react";

import StarRating from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";

export type PublicProfileHeaderProps = {
  name: string;
  avatarUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  verified?: boolean;
  averageRating?: number;
  ratingCount?: number;
  yearsExperience?: number;
  jobsDone?: number;
  categories?: string; // coma-separadas opcional
  actions?: React.ReactNode;
};

export default function PublicProfileHeader({
  name,
  avatarUrl,
  city,
  state,
  country,
  verified,
  averageRating,
  ratingCount,
  yearsExperience,
  jobsDone,
  categories,
  actions,
}: PublicProfileHeaderProps) {
  const location = [city, state, country].filter(Boolean).join(", ");
  const avatar = avatarUrl || "/avatar.png";
  const categoryChips = (categories || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt={name || "Avatar"}
          className="h-20 w-20 rounded-full border object-cover md:h-24 md:w-24"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold leading-tight truncate">{name}</h1>
            {verified ? (
              <Badge variant="default" aria-label="Perfil verificado">Verificado</Badge>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-700">
            {typeof averageRating === "number" ? (
              <span className="inline-flex items-center gap-1">
                <StarRating value={averageRating} ariaLabel={`Calificación promedio ${averageRating.toFixed(1)} de 5`} />
                <span className="text-slate-600">{(averageRating ?? 0).toFixed(1)}</span>
                {typeof ratingCount === "number" ? (
                  <span className="text-slate-500">({ratingCount} reseñas)</span>
                ) : null}
              </span>
            ) : null}
            {typeof yearsExperience === "number" ? (
              <span className="text-slate-600">{yearsExperience} años de experiencia</span>
            ) : null}
            {typeof jobsDone === "number" ? (
              <span className="text-slate-600">{jobsDone} trabajos realizados</span>
            ) : null}
            {location ? <span className="text-slate-600">{location}</span> : null}
          </div>
          {categoryChips.length ? (
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Categorías principales">
              {categoryChips.map((c) => (
                <span key={c} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? (<div className="self-center md:self-auto">{actions}</div>) : null}
    </header>
  );
}
