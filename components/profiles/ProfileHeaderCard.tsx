import * as React from "react";
import { MapPin } from "lucide-react";

import StarRating from "@/components/StarRating";

type ProfileHeaderCardProps = {
  displayName: string;
  avatarUrl: string;
  cityLabel?: string | null;
  yearsExperience?: number | null;
  jobsDone?: number | null;
  categoriesLabel?: string | null;
  serviceCities?: string[];
  rightAction?: React.ReactNode;
  averageRating?: number | null;
  reviewsCount?: number | null;
  headingClassName?: string;
  roleLabel?: string;
  isVerified?: boolean;
};

export default function ProfileHeaderCard({
  displayName,
  avatarUrl,
  cityLabel,
  yearsExperience,
  jobsDone,
  categoriesLabel,
  serviceCities = [],
  rightAction,
  averageRating,
  reviewsCount,
  headingClassName,
  roleLabel = "Profesional",
  isVerified = false,
}: ProfileHeaderCardProps) {
  const chips = [
    categoriesLabel && categoriesLabel !== "-" ? categoriesLabel : null,
    ...serviceCities,
  ].filter(Boolean) as string[];

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="h-16 w-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-primary)]" />
      <div className="flex flex-col gap-4 px-6 pb-6 pt-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl || "/avatar.png"}
              alt={displayName}
              className="h-16 w-16 rounded-full border-4 border-white bg-white object-cover shadow -mt-8 md:h-20 md:w-20 md:-mt-10"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              loading="lazy"
              decoding="async"
            />
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className={[
                    headingClassName || "",
                    "text-2xl font-semibold leading-tight text-slate-900 md:text-3xl",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {displayName}
                </h1>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {roleLabel}
                </span>
                {isVerified ? (
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                    Verificado
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {cityLabel || "Ubicación no disponible"}
                </span>
                {typeof yearsExperience === "number" ? (
                  <span>- {yearsExperience} años de experiencia</span>
                ) : null}
                {typeof jobsDone === "number" ? (
                  <span>- {jobsDone} trabajos realizados</span>
                ) : null}
              </div>
              {typeof averageRating === "number" ? (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  <StarRating
                    value={averageRating}
                    ariaLabel={`Calificación ${averageRating.toFixed(1)} de 5`}
                  />
                  <span className="font-semibold">
                    {averageRating.toFixed(1)}
                  </span>
                  {typeof reviewsCount === "number" ? (
                    <span className="text-slate-500">
                      ({reviewsCount} reseñas)
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {rightAction ? (
            <div className="self-start md:self-center">{rightAction}</div>
          ) : null}
        </div>
        {chips.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-slate-100 px-3 py-1 text-slate-700"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
