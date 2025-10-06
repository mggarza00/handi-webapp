"use client";

import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import NearbyCarousel from "@/components/professionals/NearbyCarousel.client";

export default function Page() {
  // Categorías dinámicas desde Supabase (tabla categories_subcategories)
  const [categories, setCategories] = useState<string[]>([]);
  type Subcat = { name: string; icon: string | null };
  const [subcategories, setSubcategories] = useState<Subcat[]>([]);
  const [_loadingCats, setLoadingCats] = useState(false);

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
          const rows: Array<{ category?: string | null; subcategory?: string | null; icon?: string | null }> = j?.data ?? [];
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
        } catch {
          // continúa al fallback
        }

        // 2) Fallback directo con cliente público (si RLS lo permite)
        try {
          const sb = createClientComponentClient(); const { data, error } = await sb
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
        } catch {
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
        v.src = "/video/Video Demo Homaid.mp4";
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
      } catch {
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
              Bienvenido a <span>Homaid</span>
            </h1>
            <p className="mb-6 mx-auto max-w-xl md:max-w-[60ch] lg:max-w-[56ch] text-center text-black text-xs sm:text-sm md:text-[clamp(14px,1.05vw,18px)] leading-snug md:leading-tight text-balance">
              La plataforma que te conecta con expertos de confianza para
              trabajos de mantenimiento, limpieza, reparaciones y mucho más.
            </p>
            <div className="mb-6 flex justify-center">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Perfiles verificados y calificaciones reales
              </div>
            </div>
            <div className="flex flex-row items-center justify-center gap-x-2 md:flex-wrap md:gap-y-3">
              <Link
                href="/requests/new"
                className="group inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#11304a] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#0c2336] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm whitespace-nowrap"
              >
                <MagnifierIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                Quiero solicitar un servicio
              </Link>
              <Link
                href="/pro-apply"
                className="group inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm hover:bg-slate-50 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm whitespace-nowrap"
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
                src="/video/Video Demo Homaid.mp4"
                title="Video Bienvenida Homaid"
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
                      videoRef.current?.play().catch(() => {});
                    } catch {}
                  }}
                  aria-label="Reproducir video"
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
                >
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon fill="currentColor" stroke="none" points="9,7 19,12 9,17" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Quick ask */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="mb-2 text-xl font-semibold tracking-tight">
            ¿Qué necesitas hoy?
          </h2>
          <p className="mb-5 text-sm text-slate-600">
            Elige una categoría para empezar rápido o explora todas.
          </p>

          {/* Categorías y mascota lado a lado (móvil: mascota al fondo) */}
          <div className="flex flex-row items-end justify-start gap-2 md:items-center md:justify-between md:gap-4">
            <div className="min-w-0 md:flex-1">
              <div id="categorias" className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Link
                    key={c}
                    href={`/search?category=${encodeURIComponent(c)}`}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-100"
                  >
                    {c}
                  </Link>
                ))}
                <Link
                  href="/categorias"
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-100"
                >
                  Ver todas las categorías disponibles
                </Link>
              </div>
            </div>

            <div className="flex flex-shrink-0 justify-start md:justify-end">
              <div className="relative h-[104px] w-[104px] md:h-28 md:w-28 lg:h-32 lg:w-32 animate-bounce-subtle md:animate-none">
                <Image
                  src="/images/handee_mascota.gif"
                  alt="Homaid mascota"
                  fill
                  className="object-contain"
                  unoptimized
                  priority
                />
              </div>
            </div>
          </div>

          {/* Subcategorías (carrusel) */}
          {subcategories.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-slate-700">Subcategorías</p>
              <div className="marquee" style={{ ["--marquee-duration" as any]: "150s" }}>
                <div className="marquee__inner">
                  <div className="marquee__group">
                    {subcategories.map((s) => (
                      <Link
                        key={`subcat-a-${s.name}`}
                        href={`/search?subcategory=${encodeURIComponent(s.name)}`}
                        className="rounded-full border border-slate-200 bg-white px-[0.8rem] py-[0.4rem] text-[0.7rem] text-slate-700 shadow-sm hover:bg-slate-100 inline-flex items-center gap-1"
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
                            <span className="text-sm leading-none">{s.icon}</span>
                          )
                        ) : null}
                        <span>{s.name}</span>
                      </Link>
                    ))}
                  </div>
                  {/* Duplicado para bucle continuo */}
                  <div className="marquee__group" aria-hidden="true">
                    {subcategories.map((s) => (
                      <Link
                        key={`subcat-b-${s.name}`}
                        href={`/search?subcategory=${encodeURIComponent(s.name)}`}
                        className="rounded-full border border-slate-200 bg-white px-[0.8rem] py-[0.4rem] text-[0.7rem] text-slate-700 shadow-sm hover:bg-slate-100 inline-flex items-center gap-1"
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

          {/* Nearby professionals carousel */}
          <NearbyCarousel />
        </div>
      </section>

      {/* Features */}
      <section
        className="border-y border-slate-200 bg-white"
        id="como-funciona"
      >
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-12">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight md:text-3xl">
            Cómo funciona
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
        </div>
      </section>

      {/* Steps */}
      <section className="bg-slate-50">
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <StepCard
              step="1"
              title="Publica lo que necesitas"
              desc="Describe el servicio que necesitas, presupuesto y fecha."
            />
            <StepCard
              step="2"
              title="Recibe postulaciones"
              desc="Compara perfiles, reseñas y cotizaciones."
            />
            <StepCard
              step="3"
              title="Contrata con confianza"
              desc="Acuerda condiciones y paga a través de la app."
            />
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
}: {
  step: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="absolute -top-3 left-6 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
        Paso {step}
      </div>
      <h3 className="mb-1 font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">{desc}</p>
    </div>
  );
}


