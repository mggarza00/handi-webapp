import type React from "react";
import Image from "next/image";
import Link from "next/link";

import LandingHero from "./LandingHero.client";
import LandingPageStyles from "./LandingPageStyles.client";
import LandingWarmup from "./LandingWarmup.client";
import { normalizeMediaUrl, type CategoryCard, type Subcat } from "./catalog";
import { interLight, stackSansLight, stackSansMedium } from "./landing-fonts";

import HowToUseHandiSection from "@/app/_components/HowToUseHandiSection.client";
import HomeSignInModal from "@/components/auth/HomeSignInModal.client";
import DeferOnIdle from "@/components/DeferOnIdle.client";
import HiddenIfClientHasSession from "@/components/HiddenIfClientHasSession.client";
import MobileCarousel from "@/components/MobileCarousel";
import NearbyCarousel from "@/components/professionals/NearbyCarousel.client";

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
      <section
        className="border-b border-slate-200 bg-gradient-to-b from-white via-white to-[#e8e8e8]"
        id="como-funciona"
      >
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="mb-8 space-y-2 text-center">
            <h2
              className={`${stackSansMedium.className} text-[40px] leading-[1] font-semibold tracking-[0] text-[#082877]`}
            >
              Cómo funciona
            </h2>
            <p
              className={`${interLight.className} text-sm md:text-base text-[#082877]`}
            >
              Describe lo que necesitas, compara perfiles y contrata con
              protección de pagos.
            </p>
          </div>

          {/* Mobile carousel effect */}
          <div className="md:hidden -mx-4 overflow-x-hidden">
            <DeferOnIdle
              delayMs={1500}
              fallback={<div className="h-[340px]" aria-hidden="true" />}
            >
              <MobileCarousel
                className="px-0 pt-6"
                gap={16}
                padding={16}
                autoplay
                autoplayDelay={4000}
                loop
                pauseOnHover
                threeD={false}
              >
                <StepCard
                  step="1"
                  title="Crea tu solicitud de servicio"
                  desc="Describe el servicio que necesitas, presupuesto, lugar y fecha."
                  rightImageSrc="/images/nueva-solicitud-mockup-short.png"
                />
                <StepCard
                  step="2"
                  title="Compara profesionales"
                  desc="Revisa perfiles de profesionales disponibles dentro de tu solicitud."
                  rightImageSrc="/images/profesionals-list-mockup-short.png"
                />
                <StepCard
                  step="3"
                  title="Contrata con confianza"
                  desc="Chatea con los profesionales dentro de la app, pide cotizaciones y contrata a traves del chat."
                  rightImageSrc="/images/chat-mockup-short.png"
                />
              </MobileCarousel>
            </DeferOnIdle>
          </div>

          {/* Desktop grid */}
          <div className="hidden md:grid grid-cols-1 gap-6 md:grid-cols-3">
            <StepCard
              step="1"
              title="Crea tu solicitud de servicio"
              desc="Describe el servicio que necesitas, presupuesto, lugar y fecha."
              rightImageSrc="/images/nueva-solicitud-mockup-short.png"
            />
            <StepCard
              step="2"
              title="Compara profesionales"
              desc="Revisa perfiles de profesionales disponibles dentro de tu solicitud."
              rightImageSrc="/images/profesionals-list-mockup-short.png"
            />
            <StepCard
              step="3"
              title="Contrata con confianza"
              desc="Chatea con los profesionales dentro de la app, pide cotizaciones y contrata a traves del chat."
              rightImageSrc="/images/chat-mockup-short.png"
            />
          </div>
        </div>
      </section>
    </>
  );

  const servicesSection = (
    <section
      className="border-b border-slate-200 bg-[#F5F7FA]"
      id="servicios-populares"
    >
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <div className="space-y-2">
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
                className="relative overflow-hidden rounded-2xl shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
                style={{ backgroundColor: bg }}
                aria-label={`Buscar profesionales de ${cat.name}`}
              >
                <div className="flex h-40 flex-col justify-between p-4 text-white">
                  <p
                    className={`text-xs font-medium leading-snug ${stackSansMedium.className}`}
                  >
                    {cat.name}
                  </p>
                  {isValidImageSrc(cat.image) && (
                    <div className="relative mt-3 h-20 w-full overflow-hidden rounded-xl bg-black/10">
                      <Image
                        src={cat.image as string}
                        alt={`Trabajo de ${cat.name}`}
                        fill
                        className="object-cover"
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
            className="flex h-40 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-center text-sm font-medium text-[#001447] hover:bg-slate-100"
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
                        <Link
                          key={`subcat-b-${s.name}`}
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
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-3" id="profesionales-cerca-de-ti">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600"></p>
          <DeferOnIdle
            delayMs={1500}
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

  const paymentsSection = (
    <section className="bg-slate-50 mt-6 md:mt-10">
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        <div className="mt-2 md:mt-4">
          <div className="grid overflow-hidden rounded-3xl border border-slate-200 shadow-xl md:grid-cols-[1.05fr_0.95fr]">
            <div className="relative min-h-[280px] md:min-h-[360px]">
              <Image
                src="/images/e533c387b9255d160d3c89dacf043df7010ca64b.jpg"
                alt="Profesional Handi listo para trabajar"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw"
              />
            </div>
            <div className="flex flex-col justify-between gap-10 sm:gap-8 bg-[#114430] p-6 text-white sm:p-8">
              <div className="space-y-5 relative top-6 sm:top-8">
                <div className="flex items-start gap-3">
                  <Image
                    src="/icons/candado_lima.svg"
                    alt="Candado"
                    width={80}
                    height={80}
                    className="h-[4rem] w-[4rem] sm:h-[4.5rem] sm:w-[4.5rem] flex-shrink-0"
                  />
                  <h3
                    className={`${stackSansMedium.className} text-2xl leading-tight text-white sm:text-3xl`}
                  >
                    <span className="block">Pagos 100%</span>
                    <span className="block">protegidos</span>
                  </h3>
                </div>
                <p
                  className={`${stackSansLight.className} text-sm text-white/90 sm:text-base`}
                >
                  Los pagos de los servicios se liberan a los profesionales
                  hasta que confirmes que el trabajo se realizó con éxito.
                </p>
              </div>
              <Link
                href="/pagos"
                className={`${stackSansMedium.className} inline-flex w-fit items-center justify-center rounded-full bg-[#A6D234] px-8 py-3 text-base text-[#114430] shadow-sm transition hover:bg-[#9bc32f]`}
              >
                Cómo funciona
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

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
      <HiddenIfClientHasSession>
        <HomeSignInModal />
      </HiddenIfClientHasSession>
      <LandingWarmup />
      <LandingHero
        variant={variant}
        greetingText={greetingText}
        fullName={fullName}
        savedAddresses={savedAddresses}
      />
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

function StepCard({
  step,
  title,
  desc,
  rightImageSrc,
}: {
  step: string;
  title: string;
  desc: string;
  rightImageSrc?: string;
}) {
  const withImage = Boolean(rightImageSrc);

  return (
    <div className="relative isolate overflow-visible rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="absolute -top-3 left-6 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
        Paso {step}
      </div>

      {!withImage ? (
        <div className="flex flex-col gap-2">
          <h3
            className={`${stackSansMedium.className} mb-2.5 text-lg leading-snug text-[#001447] line-clamp-2 text-balance`}
          >
            {title}
          </h3>
          <p
            className={`${stackSansLight.className} text-xs leading-snug text-slate-600 line-clamp-6`}
          >
            {desc}
          </p>
        </div>
      ) : (
        <div className="relative min-h-[196px] md:grid md:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)] md:items-stretch">
          {/* Texto a la izquierda */}
          <div className="min-w-0 pr-40 md:pr-0">
            <h3
              className={`${stackSansMedium.className} mb-2.5 text-lg leading-snug text-[#001447] line-clamp-2 text-balance`}
            >
              {title}
            </h3>
            <p
              className={`${stackSansLight.className} text-xs leading-snug text-slate-600 line-clamp-6`}
            >
              {desc}
            </p>
          </div>

          {/* Mockup en móvil: abajo a la derecha, alineado al fondo (ligeramente más a la derecha) */}
          <div className="absolute -right-4 bottom-[-1.5rem] md:hidden">
            <div
              className="relative h-56"
              style={{ width: "min(12rem, 44vw)" }}
            >
              <Image
                src={rightImageSrc as string}
                alt={title}
                fill
                className="object-contain object-bottom"
                sizes="(max-width: 768px) 12rem, 12rem"
                priority
              />
            </div>
          </div>

          {/* Mockup a la derecha */}
          <div className="hidden md:flex items-end justify-end">
            <div
              className="relative max-w-[15rem] mb-[-1.5rem]"
              style={{
                width: "min(15rem, 100%)",
                height: "calc(100% + 16px)",
              }}
            >
              <div className="relative h-full w-full">
                <Image
                  src={rightImageSrc as string}
                  alt={title}
                  fill
                  className="object-contain object-bottom"
                  sizes="(max-width: 1280px) 15rem, 18rem"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
