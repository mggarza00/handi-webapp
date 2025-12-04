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
import { useEffect, useRef, useState } from "react";
import MobileCarousel from "@/components/MobileCarousel";
import SpotlightCard from "@/components/SpotlightCard";
// import RotatingText from "@/components/RotatingText";
// import ScrollStack, { ScrollStackItem } from "@/components/ScrollStack";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import NearbyCarousel from "@/components/professionals/NearbyCarousel.client";
import HowToUseHandiSection from "./_components/HowToUseHandiSection.client";
import PaymentProtectionBadge from "@/components/PaymentProtectionBadge";

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
const MARQUEE_PILL_BASE = `relative isolate inline-flex items-center gap-1 rounded-full text-sm text-slate-900/90 bg-[rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/25 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.45)] before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-[rgba(255,255,255,0.6)] before:via-[rgba(255,255,255,0.15)] before:to-[rgba(255,255,255,0.10)] before:opacity-[0.85] before:pointer-events-none transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_24px_70px_-12px_rgba(0,0,0,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009377] data-[selected=true]:bg-white/14 data-[selected=true]:ring-white/40 data-[selected=true]:text-slate-900`;

export default function Page() {
  // Categorías dinámicas desde Supabase (tabla categories_subcategories)
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [topCategoryCards, setTopCategoryCards] = useState<CategoryCard[]>([]);
  const [subcategories, setSubcategories] = useState<Subcat[]>([]);
  const heroTitleRef = useRef<HTMLDivElement | null>(null);
  const heroSubtitleRef = useRef<HTMLParagraphElement | null>(null);

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

    const loadTopCategories = async () => {
      if (!categoryCards.length) return;
      const sb = createSupabaseBrowser();
      const { data, error } = await sb.from("requests").select("category");
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
      isMounted = false;
    };
  }, []);

  // Efecto de aparición por caracteres en el título del hero (similar a "Bienvenido a Handi")
  useEffect(() => {
    const run = async () => {
      if (!heroTitleRef.current) return;
      const root = heroTitleRef.current;
      const anyRoot = root as HTMLElement & { dataset: Record<string, string> };
      if (anyRoot.dataset?.heroSplitApplied) return;

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

      anyRoot.dataset.heroSplitApplied = "1";

      const { gsap } = await import("gsap");
      const chars = Array.from(
        root.querySelectorAll<HTMLElement>(".hero-split"),
      );
      if (!chars.length) return;
      const subtitle = heroSubtitleRef.current;
      if (subtitle) {
        gsap.set(subtitle, { opacity: 0 });
      }
      const tl = gsap.timeline();
      tl.to(chars, {
        opacity: 1,
        y: 0,
        ease: "power3.out",
        duration: 0.6,
        stagger: 0.05,
      });
      if (subtitle) {
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

  const isUrl = (s: string | null) => {
    if (!s) return false;
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return s.startsWith("/");
    }
  };

  const SubcategoriesCarousel = ({ items }: { items: Subcat[] }) => {
    if (!items.length) return null;
    const loop = [...items, ...items];
    return (
      <div className="overflow-hidden">
        <div className="subcat-marquee">
          {loop.map((s, idx) => {
            const swatch =
              s.color && s.color.startsWith("#") ? s.color : "#001447";
            const key = `${s.name}-${idx}`;
            return (
              <Link
                key={key}
                href={`/requests/new?subcategory=${encodeURIComponent(s.name)}`}
                className="inline-flex items-center gap-3 rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-[2px] hover:shadow-md"
                style={{ borderColor: swatch }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: swatch }}
                  aria-hidden="true"
                />
                {s.iconUrl && isUrl(s.iconUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.iconUrl}
                    alt=""
                    className="h-6 w-6 object-contain"
                  />
                ) : s.icon ? (
                  <span className="text-base leading-none">{s.icon}</span>
                ) : null}
                <span className="text-sm font-medium text-slate-900">
                  {s.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

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
        className="relative isolate overflow-hidden bg-slate-50"
      >
        <div className="relative w-full">
          <div className="relative aspect-[16/9] w-full md:aspect-[21/9] lg:h-[620px] min-h-[600px]">
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
            <Link
              href="/requests/new"
              className={`btn-contratar ${stackSansMedium.className} absolute left-6 top-[370px] z-10 md:left-[96px] md:top-[420px]`}
            >
              Contratar
              <span className="btn-circle" aria-hidden="true" />
            </Link>

            {/* Badge de pagos protegidos sobre el hero (solo desktop) */}
            <div className="hero-payment-badge absolute inset-0 pointer-events-none hidden md:block">
              <PaymentProtectionBadge />
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
            >
              <StepCard
                step="1"
                title={
                  <span
                    className={`${interBold.className} font-bold text-[#082877]`}
                  >
                    Crea tu solicitud de servicio
                  </span>
                }
                desc={
                  <span className={`${interLight.className} text-[#082877]`}>
                    Describe el servicio que necesitas, presupuesto, lugar y
                    fecha.
                  </span>
                }
                rightImageSrc="/images/nueva-solicitud-mockup-short.png"
              />
              <StepCard
                step="2"
                title={
                  <span
                    className={`${interBold.className} font-bold text-[#082877]`}
                  >
                    Compara profesionales
                  </span>
                }
                desc={
                  <span className={`${interLight.className} text-[#082877]`}>
                    Revisa perfiles de profesionales disponibles dentro de tu
                    solicitud.
                  </span>
                }
                rightImageSrc="/images/profesionals-list-mockup-short.png"
              />
              <StepCard
                step="3"
                title={
                  <span
                    className={`${interBold.className} font-bold text-[#082877]`}
                  >
                    Contrata con confianza
                  </span>
                }
                desc={
                  <span className={`${interLight.className} text-[#082877]`}>
                    Chatea con los profesionales dentro de la app, pide
                    cotizaciones y contrata a traves del chat.
                  </span>
                }
                rightImageSrc="/images/chat-mockup-short.png"
              />
            </MobileCarousel>
          </div>

          {/* Desktop grid */}
          <div className="hidden md:grid grid-cols-1 gap-6 md:grid-cols-3">
            <StepCard
              step="1"
              title={
                <span
                  className={`${interBold.className} font-bold text-[#082877]`}
                >
                  Crea tu solicitud de servicio
                </span>
              }
              desc={
                <span className={`${interLight.className} text-[#082877]`}>
                  Describe el servicio que necesitas, presupuesto, lugar y
                  fecha.
                </span>
              }
              rightImageSrc="/images/nueva-solicitud-mockup-short.png"
            />
            <StepCard
              step="2"
              title={
                <span
                  className={`${interBold.className} font-bold text-[#082877]`}
                >
                  Compara profesionales
                </span>
              }
              desc={
                <span className={`${interLight.className} text-[#082877]`}>
                  Revisa perfiles de profesionales disponibles dentro de tu
                  solicitud.
                </span>
              }
              rightImageSrc="/images/profesionals-list-mockup-short.png"
            />
            <StepCard
              step="3"
              title={
                <span
                  className={`${interBold.className} font-bold text-[#082877]`}
                >
                  Contrata con confianza
                </span>
              }
              desc={
                <span className={`${interLight.className} text-[#082877]`}>
                  Chatea con los profesionales dentro de la app, pide
                  cotizaciones y contrata a traves del chat.
                </span>
              }
              rightImageSrc="/images/chat-mockup-short.png"
            />
          </div>
        </div>
      </section>

      {/* Categorías y subcategorías */}
      <section
        className="border-b border-slate-200 bg-white"
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

          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
            {(topCategoryCards.length > 0 ? topCategoryCards : categoryCards)
              .slice(0, 9)
              .map((cat) => {
                const bg =
                  cat.color && cat.color.startsWith("#")
                    ? cat.color
                    : "#012A31";
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
                        className={`text-sm font-medium leading-snug ${stackSansMedium.className}`}
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
              className="flex h-40 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-center text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white text-lg">
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
              <div
                className="marquee overflow-x-hidden overflow-y-visible"
                style={{ ["--marquee-duration" as any]: MARQUEE_DURATION }}
              >
                <div className="marquee__inner">
                  <div className="marquee__group overflow-visible relative">
                    {subcategories.map((s) => {
                      const emoji = s.icon?.trim() || null;
                      const iconSrc = !emoji
                        ? normalizeMediaUrl(s.iconUrl || null)
                        : null;
                      return (
                        <Link
                          key={`subcat-a-${s.name}`}
                          href={`/search?subcategory=${encodeURIComponent(s.name)}`}
                          className="inline-flex min-w-[150px] max-w-[180px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-5 text-xs text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
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
                    className="marquee__group overflow-visible relative"
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
                          className="inline-flex min-w-[150px] max-w-[180px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-5 text-xs text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
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
          ) : null}

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600"></p>
            <NearbyCarousel />
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="bg-slate-50 mt-8 md:mt-16">
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-12">
          <div className="mt-8">
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
              <div className="flex flex-col justify-between gap-6 bg-[#114430] p-6 text-white sm:p-8">
                <div className="space-y-5">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#A6D234] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#114430]">
                    <Image
                      src="/icons/candado.png"
                      alt="Candado"
                      width={20}
                      height={20}
                      className="h-5 w-5"
                    />
                    Pagos 100% protegidos
                  </span>
                  <h3
                    className={`${stackSansMedium.className} text-3xl leading-tight text-white sm:text-4xl`}
                  >
                    Pagos 100% protegidos
                  </h3>
                  <p
                    className={`${stackSansLight.className} text-base text-white/90 sm:text-lg`}
                  >
                    Los pagos de los servicios se liberan a los profesionales
                    hasta que confirmes que el trabajo se realizó con éxito.
                  </p>
                </div>
                <Link
                  href="#como-funciona"
                  className={`${stackSansMedium.className} inline-flex w-fit items-center justify-center rounded-full bg-[#A6D234] px-8 py-3 text-base text-[#114430] shadow-sm transition hover:bg-[#9bc32f]`}
                >
                  Cómo funciona
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust badges (junto al footer) */}
      <section className="border-t border-[#001447] bg-[#001447] text-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <div className="text-center md:text-left">
              <p className="text-sm font-medium text-white">
                Confianza y transparencia
              </p>
              <p className="text-sm text-white/80">
                Política de bajas automáticas ante calificaciones bajas
                recurrentes.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-white">
              <span className="rounded-full border border-white/50 bg-white px-3 py-1 text-[#001447] shadow-sm">
                Identidad verificada
              </span>
              <span className="rounded-full border border-white/50 bg-white px-3 py-1 text-[#001447] shadow-sm">
                Referencias
              </span>
              <span className="rounded-full border border-white/50 bg-white px-3 py-1 text-[#001447] shadow-sm">
                Historial y reseñas
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
