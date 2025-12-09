"use client";

import type React from "react";
import Link from "next/link";
import Image from "next/image";
import localFont from "next/font/local";
const comfortaaBold = localFont({
  src: "../public/fonts/Comfortaa-Bold.ttf",
  display: "swap",
  weight: "700",
  variable: "--font-comfortaa-bold",
});
const momoTrust = localFont({
  src: "../public/fonts/MomoTrustDisplay-Regular.ttf",
  display: "swap",
  variable: "--font-momo-trust",
});
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import SplitText from "@/components/SplitText";
import MobileCarousel from "@/components/MobileCarousel";
import SpotlightCard from "@/components/SpotlightCard";
// import RotatingText from "@/components/RotatingText";
// import ScrollStack, { ScrollStackItem } from "@/components/ScrollStack";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import NearbyCarousel from "@/components/professionals/NearbyCarousel.client";

export default function Page() {
  const router = useRouter();
  const titleRef = useRef<HTMLSpanElement | null>(null);
  const [titleDoneSignal, setTitleDoneSignal] = useState(0);
  const marqueeDurationStyle = {
    "--marquee-duration": "150s",
  } as React.CSSProperties;
  // Categorías dinámicas desde Supabase (tabla categories_subcategories)
  const [categories, setCategories] = useState<string[]>([]);
  type Subcat = { name: string; icon: string | null };
  const [subcategories, setSubcategories] = useState<Subcat[]>([]);
  const [_loadingCats, setLoadingCats] = useState(false);

  // Rotating text and prefix slide removed

  // Animate full title as chars (Bienvenido a Handi) in a single timeline
  useEffect(() => {
    (async () => {
      try {
        if (!titleRef.current) return;
        const root = titleRef.current as HTMLElement & {
          dataset: DOMStringMap & { splitApplied?: string };
        };
        if (root.dataset.splitApplied) return;

        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: (n) =>
            n.textContent && n.textContent.length
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT,
        });
        const nodes: Text[] = [];
        while (walk.nextNode()) nodes.push(walk.currentNode as Text);
        nodes.forEach((tn) => {
          const frag = document.createDocumentFragment();
          const txt = tn.textContent || "";
          for (const ch of Array.from(txt)) {
            const span = document.createElement("span");
            span.textContent = ch === " " ? "\u00A0" : ch;
            span.className = "split-char inline-block align-baseline";
            frag.appendChild(span);
          }
          tn.parentNode?.replaceChild(frag, tn);
        });
        root.dataset.splitApplied = "1";

        const { gsap } = await import("gsap");
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        gsap.registerPlugin(ScrollTrigger);
        const chars = Array.from(
          root.querySelectorAll<HTMLElement>(".split-char"),
        );
        gsap.set(root, { visibility: "visible" });
        gsap.set(chars, { opacity: 0, y: 40 });
        gsap.to(chars, {
          opacity: 1,
          y: 0,
          ease: "power3.out",
          duration: 0.8,
          stagger: 0.06,
          scrollTrigger: {
            trigger: root.closest("section") || root,
            start: "top 85%",
            once: true,
          },
          onComplete: () => setTitleDoneSignal((v) => v + 1),
        });
      } catch (error) {
        void error;
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCats(true);
      try {
        // 1) Intentar vía API normalizada (usa service role desde el servidor)
        try {
          const r = await fetch("/api/catalog/categories", {
            cache: "no-store",
          });
          const j = await r.json();
          if (!r.ok || j?.ok === false)
            throw new Error(j?.detail || j?.error || "fetch_failed");
          const rows: Array<{
            category?: string | null;
            subcategory?: string | null;
            icon?: string | null;
          }> = j?.data ?? [];
          const listCats = Array.from(
            new Set(
              (rows || [])
                .map((x) => (x?.category ?? "").toString().trim())
                .filter((s) => s.length > 0),
            ),
          ).sort((a, b) => a.localeCompare(b));
          const subMap = new Map<string, string | null>();
          (rows || []).forEach((r) => {
            const name = (r?.subcategory ?? "").toString().trim();
            const icon = (r?.icon ?? "").toString().trim() || null;
            if (name && !subMap.has(name)) subMap.set(name, icon);
          });
          const listSubs: Subcat[] = Array.from(subMap.entries())
            .map(([name, icon]) => ({ name, icon }))
            .sort((a, b) => a.name.localeCompare(b.name));
          if (!cancelled) {
            setCategories(listCats);
            setSubcategories(listSubs);
          }
          return;
        } catch (error) {
          void error;
          // continúa al fallback
        }

        // 2) Fallback directo con cliente público (si RLS lo permite)
        try {
          const sb = createSupabaseBrowser();
          const { data, error } = await sb
            .from("categories_subcategories")
            .select('"Categoría","Subcategoría","Activa","Ícono"');
          if (error) throw error;
          const isActive = (v: unknown) => {
            const s = (v ?? "").toString().trim().toLowerCase();
            return (
              s === "sí" ||
              s === "si" ||
              s === "true" ||
              s === "1" ||
              s === "activo" ||
              s === "activa" ||
              s === "x"
            );
          };
          const listCats = Array.from(
            new Set(
              (data || [])
                .filter((row: Record<string, unknown>) =>
                  isActive(row?.["Activa"]),
                )
                .map((row: Record<string, unknown>) =>
                  (row?.["Categoría"] ?? "").toString().trim(),
                )
                .filter((s) => s.length > 0),
            ),
          ).sort((a, b) => a.localeCompare(b));
          const subMap = new Map<string, string | null>();
          (data || [])
            .filter((row: Record<string, unknown>) => isActive(row?.["Activa"]))
            .forEach((row: Record<string, unknown>) => {
              const name = (row?.["Subcategoría"] ?? "").toString().trim();
              const icon = (row?.["Ícono"] ?? "").toString().trim() || null;
              if (name && !subMap.has(name)) subMap.set(name, icon);
            });
          const listSubs: Subcat[] = Array.from(subMap.entries())
            .map(([name, icon]) => ({ name, icon }))
            .sort((a, b) => a.name.localeCompare(b.name));
          if (!cancelled) {
            setCategories(listCats);
            setSubcategories(listSubs);
          }
        } catch (error) {
          void error;
          if (!cancelled) {
            setCategories([]);
            setSubcategories([]);
          }
        }
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Video controls + dynamic poster (last frame)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = document.createElement("video");
        v.src = "/video/Handi_Video_Demo.mp4";
        v.preload = "auto";
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => resolve();
          const onError = () => reject(new Error("metadata_error"));
          v.addEventListener("loadedmetadata", onLoaded, { once: true });
          v.addEventListener("error", onError, { once: true });
        });
        const seekTime = Math.max(0, (v.duration || 0) - 0.1);
        await new Promise<void>((resolve, reject) => {
          const onSeeked = () => resolve();
          const onError = () => reject(new Error("seek_error"));
          v.addEventListener("seeked", onSeeked, { once: true });
          v.addEventListener("error", onError, { once: true });
          try {
            v.currentTime = seekTime;
          } catch {
            reject(new Error("set_time_error"));
          }
        });
        const w = v.videoWidth || 0;
        const h = v.videoHeight || 0;
        if (w > 0 && h > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(v as HTMLVideoElement, 0, 0, w, h);
            const url = canvas.toDataURL("image/jpeg", 0.86);
            if (!cancelled) setPosterUrl(url);
          }
        }
      } catch (error) {
        void error;
        // ignore; fallback poster will be used
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-white to-white"
        />
        <div className="relative mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
          <div>
            <h1 className="rubik font-medium mb-6 text-2xl sm:text-3xl md:text-4xl leading-tight tracking-wide text-center whitespace-nowrap text-[#11304a]">
              <span ref={titleRef} className="align-baseline invisible">
                Bienvenido a{" "}
                <span className="inline-flex items-baseline gap-0">
                  <span
                    className={`${comfortaaBold.className} font-bold text-[#009377]`}
                  >
                    Hand
                  </span>
                  <span
                    className={`${comfortaaBold.className} font-bold text-[#0B3949]`}
                  >
                    i
                  </span>
                </span>
              </span>
            </h1>
            <SplitText
              tag="p"
              text="La plataforma que te conecta con expertos de confianza para trabajos de mantenimiento, limpieza, reparaciones y mucho más."
              splitType="lines"
              delay={60}
              duration={2}
              ease="power3.out"
              manualStart
              startSignal={titleDoneSignal}
              textAlign="center"
              className="invisible mb-6 mx-auto max-w-xl md:max-w-[60ch] lg:max-w-[56ch] text-center text-black text-xs sm:text-sm md:text-[clamp(14px,1.05vw,18px)] leading-snug md:leading-tight text-balance"
            />
            <div className="mb-6 flex justify-center">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Perfiles verificados y calificaciones reales
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap sm:gap-x-2 sm:gap-y-3">
              <Link
                href="/requests/new"
                onClick={async (e) => {
                  try {
                    e.preventDefault();
                  } catch (error) {
                    void error;
                  }
                  try {
                    const sb = createSupabaseBrowser();
                    const { data } = await sb.auth.getSession();
                    const next = "/requests/new";
                    if (data?.session) {
                      router.push(next);
                    } else {
                      router.push(
                        `/auth/sign-in?next=${encodeURIComponent(next)}&toast=new-request`,
                      );
                    }
                  } catch (error) {
                    void error;
                    // Fallback: navega directo; /requests/new hará el gating
                    router.push("/requests/new");
                  }
                }}
                className="group inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#009377] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#0a7f6a] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm whitespace-nowrap"
              >
                <MagnifierIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                Quiero solicitar un servicio
              </Link>
              <Link
                href="/pro-apply"
                onClick={async (e) => {
                  try {
                    e.preventDefault();
                  } catch (error) {
                    void error;
                  }
                  try {
                    const sb = createSupabaseBrowser();
                    const { data } = await sb.auth.getSession();
                    const next = "/pro-apply";
                    if (data?.session) {
                      router.push(next);
                    } else {
                      router.push(
                        `/auth/sign-in?next=${encodeURIComponent(next)}&toast=pro-apply`,
                      );
                    }
                  } catch (error) {
                    void error;
                    router.push("/pro-apply");
                  }
                }}
                className="group inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B3949] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#082634] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm whitespace-nowrap"
              >
                <IdCardIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                Quiero ofrecer mis servicios
              </Link>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              ¿Ya tienes cuenta? Ve a tu perfil o revisa tus solicitudes en el
              menú.
            </p>
          </div>

          {/* Video */}
          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative aspect-video w-full">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                src="/video/Handi_Video_Demo.mp4"
                title="Video Bienvenida Handi"
                controls={showControls}
                poster={posterUrl ?? "/images/poster.png"}
                playsInline
              />
              {!showControls && (
                <button
                  type="button"
                  onClick={() => {
                    setShowControls(true);
                    try {
                      videoRef.current?.play().catch((error) => {
                        void error;
                      });
                    } catch (error) {
                      void error;
                    }
                  }}
                  aria-label="Reproducir video"
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
                >
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md">
                    <svg
                      viewBox="0 0 24 24"
                      width="28"
                      height="28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon
                        fill="currentColor"
                        stroke="none"
                        points="9,7 19,12 9,17"
                      />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features - moved above Quick ask */}
      <section
        className="border-b border-slate-200 bg-gradient-to-b from-white via-white to-[#e8e8e8]"
        id="como-funciona"
      >
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight md:text-3xl">
            Como funciona
          </h2>

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
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-10">
          <div className="mx-auto max-w-5xl" />

          {/* Categories marquee (opposite direction to subcategories) */}
          {categories.length > 0 && (
            <div className="mt-2">
              <div
                className="marquee marquee-right"
                style={marqueeDurationStyle}
              >
                <div className="marquee-inner">
                  <div className="marquee-group overflow-visible relative">
                    {categories.map((c) => (
                      <Link
                        key={`cat-a-${c}`}
                        href={`/requests/new?category=${encodeURIComponent(c)}`}
                        className="relative isolate inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm text-slate-900/90 bg-[rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/25 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.45)] before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-[rgba(255,255,255,0.6)] before:via-[rgba(255,255,255,0.15)] before:to-[rgba(255,255,255,0.10)] before:opacity-[0.85] before:pointer-events-none transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_24px_70px_-12px_rgba(0,0,0,0.55)] data-[selected=true]:bg-white/14 data-[selected=true]:ring-white/40 data-[selected=true]:text-slate-900"
                      >
                        {c}
                      </Link>
                    ))}
                  </div>
                  <div
                    className="marquee-group overflow-visible relative"
                    aria-hidden="true"
                  >
                    {categories.map((c) => (
                      <Link
                        key={`cat-b-${c}`}
                        href={`/requests/new?category=${encodeURIComponent(c)}`}
                        className="relative isolate inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm text-slate-900/90 bg-[rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/25 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.45)] before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-[rgba(255,255,255,0.6)] before:via-[rgba(255,255,255,0.15)] before:to-[rgba(255,255,255,0.10)] before:opacity-[0.85] before:pointer-events-none transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_24px_70px_-12px_rgba(0,0,0,0.55)] data-[selected=true]:bg-white/14 data-[selected=true]:ring-white/40 data-[selected=true]:text-slate-900"
                      >
                        {c}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop rotating text removed */}

          {/* Subcategorías (carrusel) */}
          {subcategories.length > 0 && (
            <div className="mt-6">
              <div className="marquee" style={marqueeDurationStyle}>
                <div className="marquee-inner">
                  <div className="marquee-group overflow-visible relative">
                    {subcategories.map((s) => (
                      <Link
                        key={`subcat-a-${s.name}`}
                        href={`/requests/new?subcategory=${encodeURIComponent(s.name)}`}
                        className="relative isolate inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-slate-900/90 bg-[rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/25 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.45)] before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-[rgba(255,255,255,0.6)] before:via-[rgba(255,255,255,0.15)] before:to-[rgba(255,255,255,0.10)] before:opacity-[0.85] before:pointer-events-none transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_24px_70px_-12px_rgba(0,0,0,0.55)] data-[selected=true]:bg-white/14 data-[selected=true]:ring-white/40 data-[selected=true]:text-slate-900"
                      >
                        {s.icon ? (
                          isUrl(s.icon) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.icon}
                              alt=""
                              className="h-3.5 w-3.5 object-contain"
                            />
                          ) : (
                            <span className="text-sm leading-none">
                              {s.icon}
                            </span>
                          )
                        ) : null}
                        <span>{s.name}</span>
                      </Link>
                    ))}
                  </div>
                  {/* Duplicado para bucle continuo */}
                  <div
                    className="marquee-group overflow-visible relative"
                    aria-hidden="true"
                  >
                    {subcategories.map((s) => (
                      <Link
                        key={`subcat-b-${s.name}`}
                        href={`/requests/new?subcategory=${encodeURIComponent(s.name)}`}
                        className="relative isolate inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-slate-900/90 bg-[rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/25 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.45)] before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-[rgba(255,255,255,0.6)] before:via-[rgba(255,255,255,0.15)] before:to-[rgba(255,255,255,0.10)] before:opacity-[0.85] before:pointer-events-none transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_24px_70px_-12px_rgba(0,0,0,0.55)] data-[selected=true]:bg-white/14 data-[selected=true]:ring-white/40 data-[selected=true]:text-slate-900"
                      >
                        {s.icon ? (
                          isUrl(s.icon) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.icon}
                              alt=""
                              className="h-3.5 w-3.5 object-contain"
                            />
                          ) : (
                            <span className="text-sm leading-none">
                              {s.icon}
                            </span>
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

          {/* Nearby professionals carousel */}
          <NearbyCarousel />
        </div>
      </section>

      {/* Steps */}
      <section className="bg-slate-50 mt-8 md:mt-16">
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-12">
          {/* Mobile carousel for features */}
          <div className="md:hidden -mx-4 overflow-x-hidden">
            <MobileCarousel
              className="px-0"
              gap={16}
              padding={16}
              autoplay
              autoplayDelay={4000}
              loop
              pauseOnHover
            >
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
            <SpotlightCard
              className="relative rounded-2xl border border-slate-200 p-6 shadow-sm"
              style={{ backgroundColor: "#104008" }}
            >
              <div
                className="pointer-events-none absolute inset-0 z-0 bg-center bg-cover opacity-70"
                style={{
                  backgroundImage:
                    'url("/images/modern-background-of-green-abstract-gradient-wallpaper-vector.jpg")',
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
                  <h3
                    className={`${momoTrust.className} font-normal uppercase text-white text-xl md:text-2xl`}
                  >
                    Pagos 100% protegidos
                  </h3>
                </div>
                <p className="text-sm text-white">
                  Los pagos de los servicios se liberan a los profesionales
                  hasta que confirmes que el trabajo se realizó con éxito.
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
              <span className="rounded-full border border-slate-200 px-3 py-1">
                Identidad verificada
              </span>
              <span className="rounded-full border border-slate-200 px-3 py-1">
                Referencias
              </span>
              <span className="rounded-full border border-slate-200 px-3 py-1">
                Historial y reseñas
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// Components
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
              style={{ width: "min(15rem, 100%)", height: "calc(100% + 16px)" }}
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
