"use client";

import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function Page() {
  // Categorías dinámicas desde Supabase (tabla categories_subcategories)
  const [categories, setCategories] = useState<string[]>([]);
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
          const rows: Array<{ category?: string | null }> = j?.data ?? [];
          const list = Array.from(
            new Set(
              (rows || [])
                .map((x) => (x?.category ?? "").toString().trim())
                .filter((s) => s.length > 0),
            ),
          ).sort((a, b) => a.localeCompare(b));
          if (!cancelled) setCategories(list);
          return;
        } catch {
          // continúa al fallback
        }

        // 2) Fallback directo con cliente público (si RLS lo permite)
        try {
          const { data, error } = await supabaseBrowser
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
          const list = Array.from(
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
          if (!cancelled) setCategories(list);
        } catch {
          if (!cancelled) setCategories([]);
        }
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
              Bienvenido a <span>Handee.mx</span>
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
            <div className="aspect-video w-full">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/xkAzsjDQj9s?rel=0&modestbranding=1&playsinline=1"
                title="Video Bienvenida Handee"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
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
                  href="/search"
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-100"
                >
                  Ver todas las categorías
                </Link>
              </div>
            </div>

            <div className="flex flex-shrink-0 justify-start md:justify-end">
              <div className="relative h-[104px] w-[104px] md:h-28 md:w-28 lg:h-32 lg:w-32 animate-bounce-subtle md:animate-none">
                <Image
                  src="/images/handee_mascota.gif"
                  alt="Handee mascota"
                  fill
                  className="object-contain"
                  unoptimized
                  priority
                />
              </div>
            </div>
          </div>
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

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Image
                  src="/handee-logo.png"
                  alt="Handee"
                  width={28}
                  height={28}
                />
                <span className="font-semibold">Handee.mx</span>
              </div>
              <p className="text-sm text-slate-600">Conecta con expertos de confianza.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Enlaces</p>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>
                  <Link href="/search" className="hover:text-slate-900">
                    Buscar profesionales
                  </Link>
                </li>
                <li>
                  <Link href="/pro-apply" className="hover:text-slate-900">
                    Ofrecer mis servicios
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-slate-900">
                    Aviso de privacidad
                  </Link>
                </li>
              </ul>
            </div>
            <div id="preguntas">
              <p className="mb-2 text-sm font-medium">Soporte</p>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>
                  WhatsApp:{" "}
                  <a
                    href="https://wa.me/5218181611335"
                    className="hover:text-slate-900"
                  >
                    +52 1 81 8161 1335
                  </a>
                </li>
                <li>
                  Email:{" "}
                  <a
                    href="mailto:hola@handee.mx"
                    className="hover:text-slate-900"
                  >
                    hola@handee.mx
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} Handee.mx. Todos los derechos reservados.
          </div>
        </div>
      </footer>
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
