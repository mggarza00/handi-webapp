import * as React from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";

type ProfileHeaderCardProps = {
  displayName: string;
  avatarUrl: string;
  cityLabel?: string | null;
  yearsExperience?: number | null;
  jobsDone?: number | null;
  serviceCities?: string[];
  bio?: string | null;
  averageRating?: number | null;
  reviewsCount?: number | null;
  headingClassName?: string;
  roleLabel?: string;
  isVerified?: boolean;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  tertiaryAction?: React.ReactNode;
};

const compactNumber = (value: number | null | undefined, fallback = "0") =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toString()
    : fallback;

export default function ProfileHeaderCard({
  displayName,
  avatarUrl,
  cityLabel,
  yearsExperience,
  jobsDone,
  serviceCities = [],
  bio,
  averageRating,
  reviewsCount,
  headingClassName,
  roleLabel = "Profesional",
  isVerified = false,
  primaryAction,
  secondaryAction,
  tertiaryAction,
}: ProfileHeaderCardProps) {
  const chips = Array.from(
    new Set(
      serviceCities
        .map((city) => city.trim())
        .filter((city) => city.length > 0),
    ),
  );
  const metrics = [
    {
      label: "Años de experiencia",
      value: typeof yearsExperience === "number" ? `${yearsExperience}+` : "—",
      icon: BriefcaseBusiness,
    },
    {
      label: "Trabajos completados",
      value: compactNumber(jobsDone),
      icon: BadgeCheck,
    },
    {
      label: "Reseñas verificadas",
      value: compactNumber(reviewsCount),
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_32px_80px_-48px_rgba(15,23,42,0.45)]">
      <div className="h-28 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(8,40,119,0.94)_48%,_rgba(5,23,66,1)_100%)]" />
      <div className="px-5 pb-5 pt-0 sm:px-7 sm:pb-7 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.9fr)]">
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl || "/avatar.png"}
                alt={displayName}
                className="-mt-14 h-28 w-28 rounded-[1.75rem] border-4 border-white bg-white object-cover shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] sm:-mt-16 sm:h-32 sm:w-32"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                loading="lazy"
                decoding="async"
              />

              <div className="min-w-0 flex-1 pt-3 sm:pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#082877]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#082877]">
                    {roleLabel}
                  </span>
                  {isVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verificado
                    </span>
                  ) : null}
                </div>

                <h1
                  className={[
                    headingClassName || "",
                    "mt-3 text-3xl leading-tight text-slate-950 sm:text-4xl",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {displayName}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-[#082877]" />
                    {cityLabel || "Ubicación no disponible"}
                  </span>
                  {typeof yearsExperience === "number" ? (
                    <span>{yearsExperience} años de experiencia</span>
                  ) : null}
                  {typeof jobsDone === "number" ? (
                    <span>{jobsDone} trabajos completados</span>
                  ) : null}
                </div>

                {typeof averageRating === "number" ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-slate-800">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                    <span>{averageRating.toFixed(1)} ★</span>
                    {typeof reviewsCount === "number" ? (
                      <span className="text-slate-500">
                        ({reviewsCount} reseñas)
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {typeof bio === "string" && bio.trim().length ? (
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                    {bio.trim()}
                  </p>
                ) : null}

                {chips.length ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-500">
                        {metric.label}
                      </span>
                      <Icon className="h-4 w-4 text-[#082877]" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">
                      {metric.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex h-full flex-col rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-5 shadow-sm sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0B6149]">
                Contrata en Handi
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                Conecta con este profesional desde una solicitud compatible
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Elige una solicitud abierta que coincida con su ciudad y
                especialidad, y continúa directo al chat para cerrar la
                contratación.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {primaryAction}
              {secondaryAction}
            </div>

            {tertiaryAction ? (
              <div className="mt-3 flex w-full flex-col items-stretch gap-3">
                {tertiaryAction}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
