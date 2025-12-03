"use client";

import type React from "react";
import Link from "next/link";
import Image from "next/image";
import localFont from "next/font/local";
const stackSansMedium = localFont({
  src: "../public/fonts/Stack_Sans_Text/static/StackSansText-Medium.ttf",
  weight: "500",
  display: "swap",
  variable: "--font-stack-sans-medium",
});
const stackSansLight = localFont({
  src: "../public/fonts/Stack_Sans_Text/static/StackSansText-Light.ttf",
  weight: "300",
  display: "swap",
  variable: "--font-stack-sans-light",
});
const interBold = localFont({
  src: "../public/fonts/Inter/static/Inter_24pt-Bold.ttf",
  weight: "700",
  display: "swap",
  variable: "--font-inter-bold",
});
const interLight = localFont({
  src: "../public/fonts/Inter/static/Inter_24pt-Light.ttf",
  weight: "300",
  display: "swap",
  variable: "--font-inter-light",
});
const momoTrust = localFont({
  src: "../public/fonts/MomoTrustDisplay-Regular.ttf",
  display: "swap",
  variable: "--font-momo-trust",
});
import { useCallback, useEffect, useState } from "react";
import MobileCarousel from "@/components/MobileCarousel";
import SpotlightCard from "@/components/SpotlightCard";
// import RotatingText from "@/components/RotatingText";
// import ScrollStack, { ScrollStackItem } from "@/components/ScrollStack";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import NearbyCarousel from "@/components/professionals/NearbyCarousel.client";
import PaymentProtectionBadge from "@/components/PaymentProtectionBadge";
import HowToUseHandiSection from "./_components/HowToUseHandiSection.client";

type Subcategory = { name: string; icon: string | null };
type CatalogRow = {
  category?: string | null;
  subcategory?: string | null;
  icon?: string | null;
};
type CatalogLists = {
  categories: string[];
  subcategories: Subcategory[];
};

const toCleanString = (value: unknown) => (value ?? "").toString().trim();
const localeSort = (a: string, b: string) =>
  a.localeCompare(b, "es", { sensitivity: "base" });
const buildCatalogLists = (rows: CatalogRow[]): CatalogLists => {
  const categories = Array.from(
    new Set(
      (rows || [])
        .map((row) => toCleanString(row.category))
        .filter((value) => value.length > 0),
    ),
  ).sort(localeSort);
  const subMap = new Map<string, string | null>();
  (rows || []).forEach((row) => {
    const name = toCleanString(row.subcategory);
    if (!name || subMap.has(name)) return;
    const icon = toCleanString(row.icon) || null;
    subMap.set(name, icon);
  });

  return {
    categories,
    subcategories: Array.from(subMap.entries())
      .map(([name, icon]) => ({ name, icon }))
      .sort((a, b) => localeSort(a.name, b.name)),
  };
};

const MARQUEE_DURATION = "150s";
const MARQUEE_PILL_BASE = `relative isolate inline-flex items-center gap-1 rounded-full text-sm text-slate-900/90 bg-[rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/25 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.45)] before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-[rgba(255,255,255,0.6)] before:via-[rgba(255,255,255,0.15)] before:to-[rgba(255,255,255,0.10)] before:opacity-[0.85] before:pointer-events-none transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_24px_70px_-12px_rgba(0,0,0,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009377] data-[selected=true]:bg-white/14 data-[selected=true]:ring-white/40 data-[selected=true]:text-slate-900`;

export default function Page() {
  const router = useRouter();
  // Categorías dinámicas desde Supabase (tabla categories_subcategories)
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  // Rotating text and prefix slide removed

  useEffect(() => {
    let isMounted = true;

    const fetchFromApi = async (): Promise<CatalogLists | null> => {
      const response = await fetch("/api/catalog/categories", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.detail || payload?.error || "fetch_failed");
      }
      return buildCatalogLists((payload?.data ?? []) as CatalogRow[]);
    };

    const fetchFromSupabase = async (): Promise<CatalogLists | null> => {
      const sb = createSupabaseBrowser();
      const { data, error } = await sb
        .from("categories_subcategories")
        .select('"Categoría","Subcategoría","Activa","Ícono"');
      if (error) throw error;
      const isActive = (value: unknown) => {
        const normalized = toCleanString(value).toLowerCase();
        return (
          normalized === "sí" ||
          normalized === "si" ||
          normalized === "true" ||
          normalized === "1" ||
          normalized === "activo" ||
          normalized === "activa" ||
          normalized === "x"
        );
      };
      const rows: CatalogRow[] = (data || [])
        .filter((row: Record<string, unknown>) => isActive(row?.["Activa"]))
        .map((row: Record<string, unknown>) => ({
          category: toCleanString(row?.["Categoría"]),
          subcategory: toCleanString(row?.["Subcategoría"]),
          icon: toCleanString(row?.["Ícono"]) || null,
        }));
      return buildCatalogLists(rows);
    };

    const applyCatalog = (lists: CatalogLists | null) => {
      if (!isMounted || !lists) return false;
      setCategories(lists.categories);
      setSubcategories(lists.subcategories);
      return true;
    };

    const loadCatalog = async () => {
      const fromApi = await fetchFromApi().catch((error) => {
        console.error("[handi] catalog/categories API failed", error);
        return null;
      });
      if (applyCatalog(fromApi)) {
        return;
      }
      const fromSupabase = await fetchFromSupabase().catch((error) => {
        console.error("[handi] Supabase catalog fallback failed", error);
        return null;
      });
      applyCatalog(fromSupabase);
    };

    void loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleProtectedNavigation = useCallback(
    async (
      event: React.MouseEvent<HTMLAnchorElement>,
      destination: string,
      toastKey: string,
    ) => {
      event.preventDefault();
      try {
        const sb = createSupabaseBrowser();
        const { data } = await sb.auth.getSession();
        if (data?.session) {
          router.push(destination);
          return;
        }
        router.push(
          `/auth/sign-in?next=${encodeURIComponent(destination)}&toast=${toastKey}`,
        );
      } catch {
        router.push(destination);
      }
    },
    [router],
  );

  const heroHighlights: Array<{
    id: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
  }> = [
    { id: "secure-payments", icon: ShieldIcon, label: "Pagos 100% protegidos" },
    { id: "verified-pros", icon: IdCardIcon, label: "Perfiles verificados y con referencias" },
    { id: "near-you", icon: PinIcon, label: "Profesionales cerca de ti" },
    { id: "top-rated", icon: StarIcon, label: "Reseñas reales en cada servicio" },
  ];

  const isUrl = (s: string | null) => {
    if (!s) return false;
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  function MagnifierIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    );
  }

  function IdCardIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="7" y1="8" x2="13" y2="8" />
        <circle cx="8.5" cy="14" r="2" />
        <path d="M12 16c0-1.657 1.79-3 4-3" />
      </svg>
    );
  }

  function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }

  function StarIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <polygon points="12 2 15 9 22 9 17 14 19 22 12 18 5 22 7 14 2 9 9 9 12 2" />
      </svg>
    );
  }

  function PinIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" />
        <circle cx="12" cy="11" r="2.5" />
      </svg>
    );
  }

  function FeatureCard({
    icon,
    title,
    desc,
  }: {
    icon: React.ReactNode;
    title: string;
    desc: string;
  }) {
    const imgMap: Record<string, string> = {
      "Encuentra cerca de ti": "/images/Encuentra cerca de ti.png",
      "Perfiles verificados": "/images/Perfiles verificados.webp",
      "Calificaciones reales": "/images/Calificaciones reales.jpg",
    };
    const imgSrc = imgMap[title];
    const containerBase =
      "relative overflow-hidden rounded-2xl border border-slate-200 p-6 shadow-sm";
    return (
      <div className={imgSrc ? containerBase : `${containerBase} bg-white`}>
        {imgSrc ? (
          <>
            <Image
              src={imgSrc}
              alt={title}
              fill
              className="absolute inset-0 z-0 h-full w-full object-cover opacity-65"
              priority={false}
            />
            <div className="pointer-events-none absolute inset-0 z-10 bg-white/70" />
          </>
        ) : null}
        <div className="relative z-20">
          {!imgSrc && (
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white">
              {icon}
            </div>
          )}
          <h3 className="mb-1 font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{desc}</p>
        </div>
      </div>
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
            <h3 className="mb-2 font-semibold text-slate-900 line-clamp-2 text-balance">
              {title}
            </h3>
            <p className="text-sm text-slate-600 line-clamp-4">{desc}</p>
          </div>
        ) : (
          <div className="relative min-h-[196px] md:grid md:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)] md:items-stretch">
            {/* Texto a la izquierda */}
            <div className="min-w-0 pr-40 md:pr-0">
              <h3 className="mb-2 font-semibold text-slate-900 line-clamp-2 text-balance">
                {title}
              </h3>
              <p className="text-sm text-slate-600 line-clamp-4">{desc}</p>
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
                  priority={false}
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
                    priority={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Hero */}
      <section
        id="hero"
        className="bg-slate-50 pt-24 md:pt-28 pb-16"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 md:flex-row md:items-start md:px-6">
          <div className="w-full md:w-1/2 space-y-5">
            <div className="space-y-5">
              <h1 className={`${stackSansMedium.className} text-3xl md:text-5xl font-semibold text-slate-900 leading-tight`}>
                No es magia,
                <br />
                es Handi
              </h1>
              <p className="text-base md:text-lg text-slate-600">
                Conecta con profesionales de confianza para resolver tus problemas en casa o en tu negocio,
                con pagos 100% protegidos.
              </p>
            </div>

            <div className="mt-4 space-y-6">
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:gap-x-2 sm:gap-y-3">
                <Link
                  href="/requests/new"
                  onClick={(event) =>
                    handleProtectedNavigation(event, "/requests/new", "new-request")
                  }
                  className="group inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#009377] px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#0a7f6a]"
                >
                  <MagnifierIcon className="h-4 w-4" />
                  Quiero solicitar un servicio
                </Link>
                <Link
                  href="/pro-apply"
                  onClick={(event) =>
                    handleProtectedNavigation(event, "/pro-apply", "pro-apply")
                  }
                  className="group inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B3949] px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#082634]"
                >
                  <IdCardIcon className="h-4 w-4" />
                  Quiero ofrecer mis servicios
                </Link>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  ¿Ya tienes cuenta? Ve a tu perfil o revisa tus solicitudes en el menú.
                </p>
                <div className="mt-3">
                  <PaymentProtectionBadge />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {heroHighlights.map(({ id, icon: Icon, label }) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-left shadow-sm backdrop-blur"
                  >
                    <Icon className="h-4 w-4 text-[#009377]" />
                    <span className="text-sm font-medium text-slate-700 text-left">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Columna derecha */}
          <div className="w-full md:w-1/2 flex justify-center md:justify-end">
            <div className="relative max-w-sm w-full rounded-3xl bg-white shadow-xl overflow-hidden">
              <Image
                src="/images/handifav_sinfondo.png"
                alt="Ilustración Handi"
                width={480}
                height={480}
                className="w-full h-auto object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <HowToUseHandiSection />

      {/* TODO: demás secciones que ya tenías */}

      {/* Features - moved above Quick ask */}
      <section
        className="border-b border-slate-200 bg-gradient-to-b from-white via-white to-[#e8e8e8]"
        id="como-funciona"
      >
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="mb-8 space-y-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Cómo funciona
            </h2>
            <p className="text-sm text-slate-600 md:text-base">
              Describe lo que necesitas, compara perfiles y contrata con protección de pagos.
            </p>
          </div>

          {/* Mobile carousel effect */}
          <div className="md:hidden -mx-4 overflow-x-hidden">
            <MobileCarousel className="px-0 pt-6" gap={16} padding={16} autoplay autoplayDelay={4000} loop pauseOnHover>
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

      {/* Quick ask */}
      <section
        className="relative bg-slate-50 bg-cover bg-center bg-no-repeat bg-fixed"
        style={{ backgroundImage: "url('/images/home_background.png')" }}
      >
        <div className="pointer-events-none absolute inset-0 z-0 bg-white/60" />
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-16">
          <header className="max-w-3xl space-y-3 text-center md:text-left">
            <p
              className={`${stackSansLight.className} text-xs font-semibold uppercase tracking-[0.35em] text-slate-500`}
            >
              Explora Handi
            </p>
            <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
              Encuentra el servicio perfecto sin salir de casa
            </h2>
            <p className="text-sm text-slate-600 md:text-base">
              Navega por categorías populares o crea tu solicitud para que expertos verificados te envíen
              cotizaciones con pagos protegidos.
            </p>
          </header>

          <div className="mt-10 space-y-8">
            {categories.length > 0 && (
              <div className="space-y-3" aria-label="Categorías populares">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">
                  Categorías populares
                </p>
                <div
                  className="marquee marquee--right"
                  style={{ ["--marquee-duration" as any]: MARQUEE_DURATION }}
                >
                  <div className="marquee__inner">
                    <div className="marquee__group overflow-visible relative">
                      {categories.map((c) => (
                        <Link
                          key={`cat-a-${c}`}
                          href={`/requests/new?category=${encodeURIComponent(c)}`}
                          className={`${MARQUEE_PILL_BASE} px-4 py-2`}
                        >
                          {c}
                        </Link>
                      ))}
                    </div>
                    <div className="marquee__group overflow-visible relative" aria-hidden="true">
                      {categories.map((c) => (
                        <Link
                          key={`cat-b-${c}`}
                          href={`/requests/new?category=${encodeURIComponent(c)}`}
                          className={`${MARQUEE_PILL_BASE} px-4 py-2`}
                        >
                          {c}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {subcategories.length > 0 && (
              <div className="space-y-3" aria-label="Subcategorías destacadas">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">
                  Subcategorías destacadas
                </p>
                <div className="marquee" style={{ ["--marquee-duration" as any]: MARQUEE_DURATION }}>
                  <div className="marquee__inner">
                    <div className="marquee__group overflow-visible relative">
                      {subcategories.map((s) => (
                        <Link
                          key={`subcat-a-${s.name}`}
                          href={`/requests/new?subcategory=${encodeURIComponent(s.name)}`}
                          className={`${MARQUEE_PILL_BASE} px-3 py-1.5`}
                        >
                          {s.icon ? (
                            isUrl(s.icon) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.icon} alt="" className="h-3.5 w-3.5 object-contain" />
                            ) : (
                              <span className="text-sm leading-none">{s.icon}</span>
                            )
                          ) : null}
                          <span>{s.name}</span>
                        </Link>
                      ))}
                    </div>
                    {/* Duplicado para bucle continuo */}
                    <div className="marquee__group overflow-visible relative" aria-hidden="true">
                      {subcategories.map((s) => (
                        <Link
                          key={`subcat-b-${s.name}`}
                          href={`/requests/new?subcategory=${encodeURIComponent(s.name)}`}
                          className={`${MARQUEE_PILL_BASE} px-3 py-1.5`}
                        >
                          {s.icon ? (
                            isUrl(s.icon) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.icon} alt="" className="h-3.5 w-3.5 object-contain" />
                            ) : (
                              <span className="text-sm leading-none">{s.icon}</span>
                            )
                          ) : null}
                          <span>{s.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">
                Profesionales cerca de ti
              </p>
              <NearbyCarousel />
            </div>
          </div>
        </div>
      </section>

      

      {/* Beneficios */}
      <section className="bg-slate-50 mt-8 md:mt-16">
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-12">
          {/* Mobile carousel for features */}
          <div className="md:hidden -mx-4 overflow-x-hidden">
            <MobileCarousel className="px-0" gap={16} padding={16} autoplay autoplayDelay={4000} loop pauseOnHover>
              <FeatureCard
                icon={<PinIcon className="h-5 w-5" />}
                title="Encuentra cerca de ti"
                desc="Publica tu servicio y encuentra profesionales cerca de ti."
              />
              <FeatureCard
                icon={<ShieldIcon className="h-5 w-5" />}
                title="Perfiles verificados"
                desc="Revisamos referencias, documentos y desempeño de todos los profesionales."
              />
              <FeatureCard
                icon={<StarIcon className="h-5 w-5" />}
                title="Calificaciones reales"
                desc="Retroalimentación de contratantes como tú."
              />
            </MobileCarousel>
          </div>

          {/* Desktop grid for features */}
          <div className="hidden md:grid grid-cols-1 gap-5 md:grid-cols-3">
            <FeatureCard
              icon={<PinIcon className="h-5 w-5" />}
              title="Encuentra cerca de ti"
              desc="Publica tu servicio y encuentra profesionales cerca de ti."
            />
            <FeatureCard
              icon={<ShieldIcon className="h-5 w-5" />}
              title="Perfiles verificados"
              desc="Revisamos referencias, documentos y desempeño de todos los profesionales."
            />
            <FeatureCard
              icon={<StarIcon className="h-5 w-5" />}
              title="Calificaciones reales"
              desc="Retroalimentación de contratantes como tú."
            />
          </div>
          <div className="mt-6">
            <SpotlightCard className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#104008] p-6 text-white shadow-sm">
              <div
                className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-70"
                style={{
                  backgroundImage:
                    "url('/images/modern-background-of-green-abstract-gradient-wallpaper-vector.jpg')",
                }}
              />
              <div className="relative z-10 mx-auto w-fit max-w-full">
                <div className="mb-1 inline-flex items-center gap-2">
                  <Image
                    src="/images/icono-pago-seguro.png"
                    alt="Pagos 100% protegidos"
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                  <h3 className={`${momoTrust.className} text-xl font-normal uppercase md:text-2xl`}>
                    Pagos 100% protegidos
                  </h3>
                </div>
                <p className="text-sm text-white/90 md:text-base">
                  Liberamos el pago al profesional únicamente cuando confirmas que el servicio quedó como esperabas.
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                  Protección en cada contratación
                </p>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <div className="text-center md:text-left">
              <p className="text-sm font-medium text-slate-900">
                Confianza y transparencia
              </p>
              <p className="text-sm text-slate-600">
                Política de bajas automáticas ante calificaciones bajas
                recurrentes.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
                Identidad verificada
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
                Referencias
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
                Historial y reseñas
              </span>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
