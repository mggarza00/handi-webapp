import type React from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

import LandingHero from "./LandingHero";
import LandingPageStyles from "./LandingPageStyles";
import { normalizeMediaUrl, type CategoryCard, type Subcat } from "./catalog";
import { stackSansMedium } from "./landing-fonts";

import DeferOnIdle from "@/components/DeferOnIdle.client";
import HowItWorksSection from "@/components/shared/HowItWorksSection";
import ProtectedPaymentsCard from "@/components/shared/ProtectedPaymentsCard";

const HowToUseHandiSection = dynamic(
  () => import("@/app/_components/HowToUseHandiSection.client"),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-auto max-w-5xl px-4 py-10 md:py-12"
        aria-hidden="true"
      />
    ),
  },
);
const HomeSignInModalHost = dynamic(
  () => import("@/components/auth/HomeSignInModalHost.client"),
  { ssr: false },
);
const OneTapMount = dynamic(() => import("@/components/OneTapMount"), {
  ssr: false,
});
const LandingWarmup = dynamic(() => import("./LandingWarmup.client"), {
  ssr: false,
});
const NearbyCarousel = dynamic(
  () => import("@/components/professionals/NearbyCarousel.client"),
  { ssr: false },
);

type LandingPageProps = {
  variant: "guest" | "client" | "other";
  greetingText?: string;
  fullName?: string | null;
  savedAddresses?: Array<{
    id?: string;
    label: string | null;
    address_line: string;
    address_place_id: string | null;
    lat: number | null;
    lng: number | null;
    last_used_at?: string | null;
    times_used?: number | null;
  }>;
  categoryCards?: CategoryCard[];
  topCategoryCards?: CategoryCard[];
  subcategories?: Subcat[];
};

const MARQUEE_DURATION = "150s";

const isValidImageSrc = (src: string | null) => {
  if (!src) return false;
  return (
    src.startsWith("/") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  );
};

export default function LandingPage({
  variant,
  greetingText,
  fullName,
  savedAddresses = [],
  categoryCards = [],
  topCategoryCards = [],
  subcategories = [],
}: LandingPageProps) {
  const isClientVariant = variant === "client";
  const categoryList =
    topCategoryCards.length > 0 ? topCategoryCards : categoryCards;

  const featuresSection = (
    <>
      {!isClientVariant && <HowToUseHandiSection />}
      <HowItWorksSection />
    </>
  );

  const servicesSection = (
    <section
      className="border-b border-slate-200 bg-gradient-to-b from-[#f8fafc] via-white to-[#eef4ff]"
      id="servicios-populares"
    >
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10 md:py-14">
        <div className="space-y-3">
          <h2
            className={`${stackSansMedium.className} text-4xl font-semibold tracking-tight text-[#082877]`}
          >
            Servicios populares
          </h2>
          <p className="text-sm text-slate-600">
            Explora las categorías más contratadas por nuestros clientes.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          {categoryList.slice(0, 9).map((cat) => {
            const bg =
              cat.color && cat.color.startsWith("#") ? cat.color : "#012A31";
            return (
              <Link
                key={`cat-card-${cat.name}`}
                href={`/professionals?category=${encodeURIComponent(cat.name)}`}
                className="group relative overflow-hidden rounded-2xl border border-white/30 shadow-[0_12px_34px_-22px_rgba(8,40,119,0.45)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-22px_rgba(8,40,119,0.6)]"
                style={{ backgroundColor: bg }}
                aria-label={`Buscar profesionales de ${cat.name}`}
              >
                <div className="flex h-40 flex-col justify-between p-4 text-white">
                  <p
                    className={`inline-flex self-start rounded-full bg-black/20 px-2.5 py-1 text-[13px] font-medium leading-snug text-white shadow-[0_6px_18px_rgba(0,0,0,0.18)] ${stackSansMedium.className}`}
                  >
                    {cat.name}
                  </p>
                  {isValidImageSrc(cat.image) && (
                    <div className="relative mt-3 h-20 w-full overflow-hidden rounded-xl bg-black/10">
                      <Image
                        src={cat.image as string}
                        alt={`Trabajo de ${cat.name}`}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(min-width: 1024px) 220px, 50vw"
                      />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          <Link
            href="/categorias"
            className="flex h-40 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-center text-sm font-medium text-[#001447] shadow-[0_12px_30px_-22px_rgba(8,40,119,0.45)] transition-all hover:-translate-y-0.5 hover:border-slate-300"
          >
            <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200 text-[#001447] text-lg">
              +
            </span>
            Ver todas las categorías
          </Link>
        </div>

        {subcategories.length > 0 ? (
          <div className="space-y-3">
            <p
              className={`${stackSansMedium.className} text-2xl font-semibold tracking-tight text-[#082877]`}
            >
              Subcategorías
            </p>
            <div className="max-w-5xl mx-auto px-4 md:px-6 bg-white rounded-3xl shadow-sm border border-slate-200">
              <div
                className="marquee overflow-x-hidden overflow-y-visible py-6"
                style={
                  {
                    ["--marquee-duration" as string]: MARQUEE_DURATION,
                    overflowY: "visible",
                  } as React.CSSProperties
                }
              >
                <div className="marquee-inner">
                  <div className="marquee-group overflow-visible relative">
                    {subcategories.map((s) => {
                      const emoji = s.icon?.trim() || null;
                      const iconSrc = !emoji
                        ? normalizeMediaUrl(s.iconUrl || null)
                        : null;
                      return (
                        <Link
                          key={`subcat-a-${s.name}`}
                          href={`/search?subcategory=${encodeURIComponent(s.name)}`}
                          className="inline-flex min-w-[150px] max-w-[180px] min-h-[180px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-6 text-xs text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
                        >
                          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
                            {emoji ? (
                              <span className="text-xl leading-none">
                                {emoji}
                              </span>
                            ) : iconSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={iconSrc}
                                alt=""
                                className="h-6 w-6 object-contain"
                              />
                            ) : null}
                          </div>
                          <span className="text-center text-sm font-medium leading-snug text-slate-800 break-words whitespace-normal">
                            {s.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  {/* Duplicado para bucle continuo */}
                  <div
                    className="marquee-group overflow-visible relative"
                    aria-hidden="true"
                  >
                    {subcategories.map((s) => {
                      const emoji = s.icon?.trim() || null;
                      const iconSrc = !emoji
                        ? normalizeMediaUrl(s.iconUrl || null)
                        : null;
                      return (
                        <div
                          key={`subcat-b-${s.name}`}
                          className="inline-flex min-w-[150px] max-w-[180px] min-h-[180px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-6 text-xs text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
                        >
                          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
                            {emoji ? (
                              <span className="text-xl leading-none">
                                {emoji}
                              </span>
                            ) : iconSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={iconSrc}
                                alt=""
                                className="h-6 w-6 object-contain"
                              />
                            ) : null}
                          </div>
                          <span className="text-center text-sm font-medium leading-snug text-slate-800 break-words whitespace-normal">
                            {s.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-3" id="profesionales-cerca-de-ti">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600"></p>
          <DeferOnIdle
            fallback={
              <div
                className="mt-12 rounded-[32px] bg-white px-4 py-12 shadow-[0_22px_70px_-40px_rgba(8,40,119,0.45)] ring-1 ring-slate-100/80 md:px-8"
                aria-hidden="true"
              >
                <div className="mx-auto h-8 w-56 rounded-full bg-slate-200" />
                <div className="mt-10 h-[320px] rounded-3xl bg-slate-100" />
              </div>
            }
          >
            <NearbyCarousel />
          </DeferOnIdle>
        </div>
      </div>
    </section>
  );

  const paymentsSection = <ProtectedPaymentsCard />;

  const trustSection = (
    <section className="border-t border-[#001447] bg-[#001447] text-white -mb-16 md:mb-0">
      <div className="mx-auto max-w-5xl px-4 pb-0 pt-6 md:py-8">
        <div className="flex min-h-[130px] flex-col items-center gap-3 md:min-h-[110px] md:flex-row md:justify-between md:items-center">
          <div className="text-center md:text-left space-y-1.5">
            <p className="text-sm font-medium text-white">
              Confianza y transparencia
            </p>
            <p className="text-sm text-white/80">
              Política de bajas automáticas ante calificaciones bajas
              recurrentes.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white">
            <span className="rounded-full border border-white/50 bg-white px-2.5 py-1 text-[#001447] shadow-sm leading-none whitespace-nowrap">
              Identidad verificada
            </span>
            <span className="rounded-full border border-white/50 bg-white px-2.5 py-1 text-[#001447] shadow-sm leading-none whitespace-nowrap">
              Referencias
            </span>
            <span className="rounded-full border border-white/50 bg-white px-2.5 py-1 text-[#001447] shadow-sm leading-none whitespace-nowrap">
              Historial y reseñas
            </span>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <LandingHero
        variant={variant}
        greetingText={greetingText}
        fullName={fullName}
        savedAddresses={savedAddresses}
      />
      {variant === "guest" ? <OneTapMount /> : null}
      {variant === "guest" ? <HomeSignInModalHost /> : null}
      <DeferOnIdle delayMs={1600} timeoutMs={4200}>
        <LandingWarmup />
      </DeferOnIdle>
      {isClientVariant ? (
        <>
          {servicesSection}
          {featuresSection}
          {paymentsSection}
          {trustSection}
        </>
      ) : (
        <>
          {featuresSection}
          {servicesSection}
          {paymentsSection}
          {trustSection}
        </>
      )}
      <LandingPageStyles />
    </main>
  );
}
