import type { ReactNode } from "react";
import Image from "next/image";

type LocalMarketplaceHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  quickSignals?: string[];
  ctas: ReactNode;
  secondaryNote?: string;
  aside?: ReactNode;
  stickyAside?: boolean;
  imageSrc?: string;
  imageAlt?: string;
  imageSizes?: string;
};

export default function LocalMarketplaceHero({
  eyebrow,
  title,
  subtitle,
  quickSignals = [],
  ctas,
  secondaryNote,
  aside,
  stickyAside = false,
  imageSrc,
  imageAlt = "Imagen de apoyo",
  imageSizes = "(min-width: 1024px) 32vw, 100vw",
}: LocalMarketplaceHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-300/70 bg-gradient-to-br from-[#f6f9ff] via-white to-[#edf3ff] p-4 shadow-[0_24px_60px_-36px_rgba(8,40,119,0.6)] md:p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 -translate-y-1/4 translate-x-1/4 rounded-full bg-[#d8e7ff] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 left-12 h-24 w-24 rounded-full bg-[#e7f0ff] blur-2xl" />
      {imageSrc ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-300/80 bg-white shadow-[0_16px_34px_-24px_rgba(8,40,119,0.55)] lg:hidden">
          <div className="relative aspect-[16/9] w-full">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              className="rounded-xl object-cover w-full h-full"
              sizes="100vw"
            />
          </div>
        </div>
      ) : null}
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:items-start">
        <div className="space-y-3">
          {eyebrow ? (
            <p className="text-xs font-semibold tracking-[0.18em] text-[#3153a6] uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold leading-tight text-slate-950 md:text-4xl">
            {title}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate-600 md:text-base">
            {subtitle}
          </p>
          {quickSignals.length ? (
            <ul className="flex flex-wrap gap-2 pt-1.5">
              {quickSignals.map((signal) => (
                <li
                  key={signal}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                >
                  {signal}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="pt-1.5">{ctas}</div>
          {secondaryNote ? (
            <p className="text-xs text-slate-500">{secondaryNote}</p>
          ) : null}
        </div>
        <div className="space-y-3">
          {imageSrc ? (
            <div className="relative hidden overflow-hidden rounded-2xl border border-slate-300/80 bg-white shadow-[0_16px_34px_-24px_rgba(8,40,119,0.55)] lg:block">
              <div className="relative aspect-[16/9] w-full">
                <Image
                  src={imageSrc}
                  alt={imageAlt}
                  fill
                  className="rounded-xl object-cover w-full h-full"
                  sizes={imageSizes}
                />
              </div>
            </div>
          ) : null}
          {aside ? (
            <div
              className={`rounded-2xl border border-slate-300/80 bg-white p-4 shadow-[0_16px_34px_-24px_rgba(8,40,119,0.55)] ${stickyAside ? "lg:sticky lg:top-24" : ""}`}
            >
              {aside}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
