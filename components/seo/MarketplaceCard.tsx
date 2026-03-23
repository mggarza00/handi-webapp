import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

type MarketplaceCardProps = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  badges?: string[];
  icon?: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
};

export default function MarketplaceCard({
  title,
  description,
  href,
  ctaLabel,
  badges = [],
  icon,
  imageSrc,
  imageAlt = "",
}: MarketplaceCardProps) {
  return (
    <article className="group relative isolate overflow-hidden rounded-2xl border border-slate-300/80 bg-gradient-to-b from-white to-slate-50/70 shadow-[0_12px_32px_-22px_rgba(8,40,119,0.45)] transition-all hover:-translate-y-1 hover:border-slate-400 hover:shadow-[0_24px_44px_-24px_rgba(8,40,119,0.6)]">
      {imageSrc ? (
        <div className="h-40 w-full overflow-hidden rounded-t-xl border-b border-slate-200 bg-slate-100">
          <div className="relative h-full w-full">
            <Image
              src={imageSrc}
              alt={imageAlt || title}
              fill
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
              sizes="(min-width: 1280px) 26vw, (min-width: 768px) 45vw, 100vw"
            />
          </div>
        </div>
      ) : null}
      <div className="relative p-4 md:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-10 bg-gradient-to-r from-[#edf3ff] to-transparent opacity-70" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
            {icon ? (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef4ff] text-[#1f3d8f]">
                {icon}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {description}
          </p>
          {badges.length ? (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {badges.slice(0, 3).map((badge) => (
                <li
                  key={badge}
                  className="rounded-full border border-slate-300/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                >
                  {badge}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5">
            <Link
              href={href}
              className="inline-flex items-center rounded-full bg-[#082877] px-3.5 py-1.5 text-xs font-semibold text-white transition group-hover:bg-[#0b3cc2]"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
