"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";

import LandingWarmup from "./LandingWarmup.client";

import HowToUseHandiSection from "@/app/_components/HowToUseHandiSection.client";
import HeroClientActions from "@/components/home/HeroClientActions.client";
import HiddenIfClientHasSession from "@/components/HiddenIfClientHasSession.client";
import MobileCarousel from "@/components/MobileCarousel";
import NearbyCarousel from "@/components/professionals/NearbyCarousel.client";
import PaymentProtectionBadge from "@/components/PaymentProtectionBadge";
import RoleSelectionDialog from "@/components/RoleSelectionDialog.client";
import HomeSignInModal from "@/components/auth/HomeSignInModal.client";
import { openCreateRequestWizard } from "@/components/requests/CreateRequestWizardRoot";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const stackSansMedium = localFont({
  src: "../../../public/fonts/Stack_Sans_Text/static/StackSansText-Medium.ttf",
  weight: "500",
  display: "swap",
  variable: "--font-stack-sans-medium",
});
const stackSansExtraLight = localFont({
  src: "../../../public/fonts/Stack_Sans_Text/static/StackSansText-ExtraLight.ttf",
  weight: "200",
  display: "swap",
  variable: "--font-stack-sans-extralight",
});
const stackSansLight = localFont({
  src: "../../../public/fonts/Stack_Sans_Text/static/StackSansText-Light.ttf",
  weight: "300",
  display: "swap",
  variable: "--font-stack-sans-light",
});
const interLight = localFont({
  src: "../../../public/fonts/Inter/static/Inter_24pt-Light.ttf",
  weight: "300",
  display: "swap",
  variable: "--font-inter-light",
});

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
};

type CategoryCard = {
  name: string;
  color: string | null;
  image: string | null;
};

type Subcat = {
  name: string;
  icon: string | null;
  color: string | null;
  iconUrl: string | null;
};
type CatalogRow = {
  category?: string | null;
  subcategory?: string | null;
  icon?: string | null;
  iconUrl?: string | null;
  image?: string | null;
  color?: string | null;
};
type CatalogLists = {
  categoryCards: CategoryCard[];
  subcategories: Subcat[];
};

const toCleanString = (value: unknown) => (value ?? "").toString().trim();
const localeSort = (a: string, b: string) =>
  a.localeCompare(b, "es", { sensitivity: "base" });
const normalizeMediaUrl = (value: string | null | undefined) => {
  const raw = toCleanString(value);
  if (!raw) return null;
  const s = raw
    .replace(/^["']+|["']+$/g, "")
    .replace(/\\/g, "/")
    .trim();
  if (!s) return null;
  // paths absolutos locales: recorta hasta /public/ si existe
  const lower = s.toLowerCase();
  const publicIdx = lower.indexOf("/public/");
  if (publicIdx >= 0) {
    const tail = s.slice(publicIdx + "/public".length);
    return tail.startsWith("/") ? tail : `/${tail}`;
  }
  // Si viene con drive (C:/...) sin /public/, intenta detectar carpeta images/categorias
  if (
    /^[a-zA-Z]:\//.test(s) ||
    (s.startsWith("/") && /^[a-zA-Z]:\//.test(s.slice(1)))
  ) {
    const imagesIdx = lower.indexOf("/images/");
    const iconsIdx = lower.indexOf("/icons/");
    const idx = imagesIdx >= 0 ? imagesIdx : iconsIdx;
    if (idx >= 0) {
      const tail = s.slice(idx);
      return tail.startsWith("/") ? tail : `/${tail}`;
    }
    return null;
  }
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return s;
  if (s.includes("://")) return null;
  // rutas relativas dentro de public (ej: images/categorias/archivo.jpg)
  if (lower.startsWith("images/")) return `/${s}`;
  return `/${s.replace(/^\/+/, "")}`;
};
const isValidImageSrc = (src: string | null) => {
  if (!src) return false;
  return (
    src.startsWith("/") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  );
};
const buildCatalogLists = (rows: CatalogRow[]): CatalogLists => {
  const catMeta = new Map<
    string,
    { color: string | null; image: string | null }
  >();
  const subMap = new Map<string, Subcat>();

  (rows || []).forEach((row) => {
    const categoryName = toCleanString(row.category);
    const subName = toCleanString(row.subcategory);
    const icon = toCleanString(row.icon) || null;
    const iconUrl = normalizeMediaUrl(row.iconUrl);
    const image = normalizeMediaUrl(row.image);
    const color = toCleanString(row.color) || null;

    if (categoryName.length > 0) {
      const existing = catMeta.get(categoryName) || {
        color: null,
        image: null,
      };
      catMeta.set(categoryName, {
        color: existing.color || color || null,
        image: existing.image || image || null,
      });
    }

    if (subName.length > 0 && !subMap.has(subName)) {
      subMap.set(subName, {
        name: subName,
        icon,
        iconUrl,
        color,
      });
    }
  });

  return {
    categoryCards: Array.from(catMeta.entries())
      .map(([name, meta]) => ({
        name,
        color: meta.color,
        image: meta.image,
      }))
      .sort((a, b) => localeSort(a.name, b.name)),
    subcategories: Array.from(subMap.values()).sort((a, b) =>
      localeSort(a.name, b.name),
    ),
  };
};

const MARQUEE_DURATION = "150s";
const heroMarginTop = "4.25rem";

export default function Page({
  variant,
  greetingText,
  fullName: incomingName,
  savedAddresses = [],
}: LandingPageProps) {
  const isClientVariant = variant === "client";
  const displayName = (incomingName || "").toString().trim() || "Cliente";
  const resolvedGreeting =
    (greetingText || "").trim() || `Bienvenido(a) ${displayName}`;
  const [greetingFirstWord, ...greetingRestParts] =
    resolvedGreeting.split(/\s+/);
  const greetingRest = greetingRestParts.join(" ") || displayName;
  // Categorías dinámicas desde Supabase (tabla categories_subcategories)
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [topCategoryCards, setTopCategoryCards] = useState<CategoryCard[]>([]);
  const [subcategories, setSubcategories] = useState<Subcat[]>([]);
  type SavedAddress = NonNullable<LandingPageProps["savedAddresses"]>[number];
  const initialSaved = Array.isArray(savedAddresses) ? savedAddresses : [];
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(
    initialSaved[0] ?? null,
  );
  const heroTitleRef = useRef<HTMLDivElement | null>(null);
  const heroClientTitleRef = useRef<HTMLParagraphElement | null>(null);
  const heroSubtitleRef = useRef<HTMLParagraphElement | null>(null);

  // Rotating text and prefix slide removed

  useEffect(() => {
    const addresses = savedAddresses ?? [];
    if (addresses.length === 0) {
      setSelectedAddress(null);
      return;
    }
    setSelectedAddress((current) => current ?? addresses[0] ?? null);
  }, [savedAddresses]);

  useEffect(() => {
    if (!isClientVariant) return;
    if (typeof window === "undefined") return;
    const STORAGE_KEY = "handi:auto-open-request-wizard";
    const shouldAutoOpen =
      window.sessionStorage.getItem(STORAGE_KEY) === "pending";
    if (!shouldAutoOpen) return;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const timer = window.setTimeout(() => {
      openCreateRequestWizard();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isClientVariant]);

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
      const primary = await sb.from("categories_subcategories").select("*");
      const data = primary.data as unknown[] | null;
      const error = primary.error as { message: string; code?: string } | null;
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
      const pick = (rec: Record<string, unknown>, keys: string[]) => {
        for (const k of keys) {
          const val = rec?.[k];
          if (
            val !== undefined &&
            val !== null &&
            String(val).trim().length > 0
          ) {
            return String(val).trim();
          }
        }
        return null;
      };
      const rows: CatalogRow[] = (data || [])
        .filter((row: Record<string, unknown>) => isActive(row?.["Activa"]))
        .map((row: Record<string, unknown>) => ({
          category: toCleanString(row?.["Categoría"]),
          subcategory: toCleanString(row?.["Subcategoría"]),
          icon: toCleanString(row?.["Emoji"]) || null,
          iconUrl: pick(row, [
            "ícono",
            "icono",
            "icon",
            "icon_url",
            "icono_url",
            "iconUrl",
            "Ícono URL",
          ]),
          image: pick(row, ["imagen", "image"]),
          color: pick(row, ["color"]),
        }));
      return buildCatalogLists(rows);
    };

    const applyCatalog = (lists: CatalogLists | null) => {
      if (!isMounted || !lists) return false;
      setCategoryCards(lists.categoryCards);
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

  useEffect(() => {
    let cancelled = false;
    const loadTopCategories = async () => {
      if (!categoryCards.length) {
        setTopCategoryCards([]);
        return;
      }
      const sb = createSupabaseBrowser();
      const { data, error } = await sb.from("requests").select("category");
      if (cancelled) return;
      if (error || !Array.isArray(data)) {
        setTopCategoryCards(categoryCards.slice(0, 8));
        return;
      }
      const counts = new Map<string, number>();
      data.forEach((row) => {
        const name = toCleanString((row as Record<string, unknown>)?.category);
        if (!name) return;
        counts.set(name, (counts.get(name) || 0) + 1);
      });
      const sorted = [...categoryCards].sort((a, b) => {
        const diff = (counts.get(b.name) || 0) - (counts.get(a.name) || 0);
        if (diff !== 0) return diff;
        return localeSort(a.name, b.name);
      });
      setTopCategoryCards(sorted.slice(0, 8));
    };

    void loadTopCategories();

    return () => {
      cancelled = true;
    };
  }, [categoryCards]);

  // Efecto de aparición por caracteres en el título del hero (similar a "Bienvenido a Handi")
  useEffect(() => {
    const run = async () => {
      const applySplit = (root: HTMLElement | null): HTMLElement[] => {
        if (!root) return [];
        const anyRoot = root as HTMLElement & {
          dataset?: Record<string, string>;
        };
        if (anyRoot.dataset?.heroSplitApplied) {
          return Array.from(root.querySelectorAll<HTMLElement>(".hero-split"));
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) =>
            node.textContent && node.textContent.trim().length > 0
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT,
        });

        const textNodes: Text[] = [];
        while (walker.nextNode()) {
          textNodes.push(walker.currentNode as Text);
        }

        textNodes.forEach((tn) => {
          const frag = document.createDocumentFragment();
          const chars = tn.textContent || "";
          for (const ch of Array.from(chars)) {
            const span = document.createElement("span");
            span.textContent = ch === " " ? "\u00A0" : ch;
            span.className =
              "hero-split inline-block align-baseline opacity-0 translate-y-6";
            frag.appendChild(span);
          }
          tn.parentNode?.replaceChild(frag, tn);
        });

        if (anyRoot.dataset) {
          anyRoot.dataset.heroSplitApplied = "1";
        }

        return Array.from(root.querySelectorAll<HTMLElement>(".hero-split"));
      };

      const titleChars = applySplit(heroTitleRef.current);
      const clientChars = applySplit(heroClientTitleRef.current);

      const allChars = [...titleChars, ...clientChars];
      if (!allChars.length) return;

      const { gsap } = await import("gsap");

      const subtitle = heroSubtitleRef.current;
      if (subtitle) {
        gsap.set(subtitle, { opacity: 0 });
      }
      const tl = gsap.timeline();
      tl.to(allChars, {
        opacity: 1,
        y: 0,
        ease: "power3.out",
        duration: 0.6,
        stagger: 0.05,
      });
      if (subtitle && titleChars.length) {
        tl.to(
          subtitle,
          {
            opacity: 1,
            ease: "power2.out",
            duration: 0.8,
          },
          "+=0.05",
        );
      }
    };

    void run();
  }, []);

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

  const heroGuest = (
    <section id="hero" className="relative isolate overflow-hidden bg-slate-50">
      <div className="relative w-full">
        <div
          className="guest-hero__visual relative w-full md:aspect-[21/9] lg:h-[620px]"
          style={{ minHeight: "calc(100vh - var(--hero-header-height))" }}
        >
          <Image
            src="/images/be204f42cd07529e6b8dc2c7c9218d6f5728f12b.jpg"
            alt="Profesional industrial trabajando con equipo de seguridad"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div
            className={`${stackSansMedium.className} absolute left-6 top-36 w-[240px] text-white font-semibold leading-[1.04] text-[26px] drop-shadow-[0_14px_32px_rgba(0,0,0,0.55)] md:left-[96px] md:top-[180px] md:w-[300px] md:text-[38px]`}
            ref={heroTitleRef}
          >
            <span className="block">No es magia,</span>
            <span className="block">es Handi</span>
          </div>
          <p
            className={`${interLight.className} absolute left-6 top-[220px] w-[260px] text-white text-sm leading-snug text-left opacity-0 drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)] md:left-[96px] md:top-[270px] md:w-[380px] md:text-base`}
            ref={heroSubtitleRef}
          >
            <span className="block font-semibold">
              Conecta con profesionales
            </span>
            <span className="block">
              de <em className="italic">confianza</em> para cualquier
            </span>
            <span className="block">servicio en tu hogar</span>
          </p>
          <HiddenIfClientHasSession>
            <div className="absolute left-6 top-[370px] z-10 md:left-[96px] md:top-[420px]">
              <RoleSelectionDialog
                triggerLabel="Comenzar"
                triggerClassName={`btn-contratar ${stackSansMedium.className}`}
                triggerShowCircle
              />
            </div>
          </HiddenIfClientHasSession>

          {/* Badge de pagos protegidos sobre el hero (solo desktop) */}
          <div className="hero-payment-badge absolute inset-0 pointer-events-none hidden md:block">
            <PaymentProtectionBadge />
          </div>
        </div>
      </div>
    </section>
  );

  const heroClient = (
    <div
      style={{ marginTop: heroMarginTop }}
      className="px-4 pb-8 sm:px-[2.625rem]"
    >
      <div className="mx-auto max-w-6xl rounded-3xl bg-white shadow-sm overflow-hidden px-0">
        <section
          id="hero-client"
          className="client-hero relative isolate overflow-hidden bg-slate-900 text-white"
        >
          <div className="relative w-full">
            <div className="client-hero__visual relative w-full min-h-[400px] sm:aspect-[16/9] sm:min-h-[480px] md:aspect-[21/9] md:min-h-[520px] lg:min-h-[560px] xl:min-h-[600px] max-h-[880px]">
              <Image
                src="/images/ac305e5695416fe62abbe78d5ed7297e99cebbfa (1).jpg"
                alt="Cliente Handi en casa"
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/45 to-black/20" />
              <div className="absolute inset-0 flex h-full flex-col justify-center px-6 py-8 md:block md:px-0 md:py-0">
                <div className="md:absolute md:left-[96px] md:top-[60px] lg:top-[70px] absolute left-6 top-6 sm:static sm:left-auto sm:top-auto">
                  <h1
                    className={`${stackSansMedium.className} text-2xl leading-tight sm:text-4xl`}
                  >
                    <span
                      className={`${stackSansExtraLight.className} leading-tight text-[22px] sm:text-[32px] tracking-[-0.02em] font-light text-white`}
                      style={{ fontFamily: '"Stack Sans Text", sans-serif' }}
                    >
                      {greetingFirstWord}
                    </span>
                    <span
                      className={`${interLight.className} text-[22px] sm:text-[32px] leading-tight tracking-[-0.02em] font-light`}
                    >
                      ,
                    </span>{" "}
                    <span
                      className={`${stackSansLight.className} font-light text-white`}
                      style={{ fontFamily: '"Stack Sans Text", sans-serif' }}
                    >
                      {greetingRest}
                    </span>
                  </h1>
                </div>
                <div className="md:absolute md:left-[96px] md:top-[210px] lg:top-[230px] mb-8 md:mb-0">
                  <div className="flex flex-col gap-4">
                    <p
                      ref={heroClientTitleRef}
                      style={{
                        fontFamily:
                          '"Stack Sans Text", system-ui, -apple-system, "Segoe UI", sans-serif',
                        fontWeight: 400,
                        fontStyle: "normal",
                        letterSpacing: "0%",
                      }}
                      className={`${stackSansMedium.className} max-w-2xl text-white text-[38px] sm:text-[50px] leading-[1.06]`}
                    >
                      <span
                        className={`${stackSansLight.className} block leading-[1.06] font-thin`}
                      >
                        Profesionales
                      </span>
                      <span className="block leading-[1.06]">a tu alcance</span>
                    </p>
                    <div className="mt-[70px] md:mt-12">
                      <HeroClientActions
                        ctaLabel="Solicitar un servicio"
                        addresses={savedAddresses}
                        selectedAddress={selectedAddress}
                        onAddressChange={(addr) =>
                          setSelectedAddress(
                            addr
                              ? {
                                  ...addr,
                                  label: addr.label ?? null,
                                  address_place_id:
                                    addr.address_place_id ?? null,
                                  lat: addr.lat ?? null,
                                  lng: addr.lng ?? null,
                                }
                              : null,
                          )
                        }
                        triggerClassName={`btn-contratar ${stackSansMedium.className}`}
                        showPill={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <HeroClientActions
                ctaLabel="Solicitar un servicio"
                addresses={savedAddresses}
                selectedAddress={selectedAddress}
                onAddressChange={(addr) =>
                  setSelectedAddress(
                    addr
                      ? {
                          ...addr,
                          label: addr.label ?? null,
                          address_place_id: addr.address_place_id ?? null,
                          lat: addr.lat ?? null,
                          lng: addr.lng ?? null,
                        }
                      : null,
                  )
                }
                showButton={false}
                addressPillClassName="absolute bottom-6 right-6 z-20 -mt-20 md:mt-0 md:bottom-8 md:right-10"
              />
              <div className="hero-payment-badge absolute inset-0 pointer-events-none hidden md:block">
                <PaymentProtectionBadge />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

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
          {(topCategoryCards.length > 0 ? topCategoryCards : categoryCards)
            .slice(0, 9)
            .map((cat) => {
              const bg =
                cat.color && cat.color.startsWith("#") ? cat.color : "#012A31";
              return (
                <Link
                  key={`cat-card-${cat.name}`}
                  href={`/search?category=${encodeURIComponent(cat.name)}`}
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
          <NearbyCarousel />
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
      {isClientVariant ? heroClient : heroGuest}
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
      <style jsx global>{`
        :root {
          --hero-header-height: 64px;
          --hero-tabbar-height: 72px;
          --hero-padding: 24px;
        }
        @media (width <= 768px) {
          .client-hero__visual {
            min-height: calc(
              100vh - var(--hero-header-height) - var(--hero-tabbar-height) -
                (2 * var(--hero-padding))
            );
            padding-bottom: calc(
              var(--hero-padding) + env(safe-area-inset-bottom, 0px)
            );
          }
          .guest-hero__visual {
            min-height: calc(
              100vh - var(--hero-header-height) - (1.5 * var(--hero-padding))
            );
            padding-bottom: calc(
              var(--hero-padding) + env(safe-area-inset-bottom, 0px)
            );
          }
        }
      `}</style>
    </main>
  );
}
