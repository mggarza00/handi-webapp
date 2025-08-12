"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Page() {
  const [play, setPlay] = useState(false);

  const categories = [
    "Electricidad",
    "Plomería",
    "Albañilería",
    "Pintura",
    "Carpintería",
    "Jardinería",
    "Aire acondicionado",
    "Limpieza",
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Image src="/handee-logo.png" alt="Handee" width={36} height={36} className="rounded" priority />
            <span className="text-lg font-semibold tracking-tight">Handee</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#como-funciona" className="text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded">Cómo funciona</a>
            <a href="#categorias" className="text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded">Categorías</a>
            <a href="#preguntas" className="text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded">Preguntas</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300">Entrar</Link>
            <Link href="/postulate" className="hidden rounded-xl bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 md:inline-block">Ofrecer mis servicios</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-white to-white" />
        <div className="relative mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Perfiles verificados y calificaciones reales
            </div>
            <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              Encuentra profesionales confiables cerca de ti
            </h1>
            <p className="mb-6 max-w-xl text-slate-600">
              Publica lo que necesitas o ofrece tus servicios. Rápido, seguro y con transparencia.
            </p>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row">
              <Link
                href="/search"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                aria-label="Contratar un profesional"
              >
                <MagnifierIcon className="h-4 w-4" />
                Contratar ahora
              </Link>
              <Link
                href="/postulate"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                aria-label="Ofrecer mis servicios"
              >
                <IdCardIcon className="h-4 w-4" />
                Ofrecer mis servicios
              </Link>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              ¿Ya tienes cuenta? Ve a tu perfil o revisa tus solicitudes en el menú.
            </p>
          </div>

          {/* Video: click-to-play para mejorar LCP */}
          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="aspect-video w-full">
              {!play ? (
                <button
                  type="button"
                  onClick={() => setPlay(true)}
                  className="relative h-full w-full"
                  aria-label="Reproducir video de bienvenida"
                >
                  <Image
                    src="https://img.youtube.com/vi/xkAzsjDQj9s/hqdefault.jpg"
                    alt="Video Bienvenida Handee"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <span className="absolute inset-0 bg-black/20" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow">
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-slate-900" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                </button>
              ) : (
                <iframe
                  className="h-full w-full"
                  src="https://www.youtube.com/embed/xkAzsjDQj9s?autoplay=1&rel=0&modestbranding=1&playsinline=1"
                  title="Video Bienvenida Handee"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  loading="lazy"
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Quick ask */}
      <section className="bg-slate-50" id="categorias">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="mb-2 text-xl font-semibold tracking-tight">¿Qué necesitas hoy?</h2>
          <p className="mb-5 text-sm text-slate-600">Elige una categoría para empezar rápido o explora todas.</p>

          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c}
                href={/search?category=\}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                aria-label={"Buscar profesionales de " + c}
              >
                {c}
              </Link>
            ))}
            <Link
              href="/search"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              Ver todas las categorías
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-slate-200 bg-white" id="como-funciona">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight md:text-3xl">¿Cómo funciona?</h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <FeatureCard icon={<PinIcon className="h-5 w-5" />} title="Encuentra cerca de ti" desc="Filtra por ciudad, categoría y disponibilidad." />
            <FeatureCard icon={<ShieldIcon className="h-5 w-5" />} title="Perfiles verificados" desc="Revisamos referencias, documentos y desempeño." />
            <FeatureCard icon={<StarIcon className="h-5 w-5" />} title="Calificaciones reales" desc="Retroalimentación de contratantes como tú." />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <StepCard step="1" title="Publica lo que necesitas" desc="Describe tu trabajo, presupuesto y fecha." />
            <StepCard step="2" title="Recibe postulaciones" desc="Compara perfiles, reseñas y cotizaciones." />
            <StepCard step="3" title="Contrata con confianza" desc="Acorde al alcance y paga directo al profesional." />
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-t border-slate-200 bg-white" id="preguntas">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <div className="text-center md:text-left">
              <p className="text-sm font-medium text-slate-900">Confianza y transparencia</p>
              <p className="text-sm text-slate-600">Política de bajas automáticas ante calificaciones bajas recurrentes.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 px-3 py-1">Identidad verificada</span>
              <span className="rounded-full border border-slate-200 px-3 py-1">Referencias</span>
              <span className="rounded-full border border-slate-200 px-3 py-1">Historial y reseñas</span>
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
                <Image src="/handee-logo.png" alt="Handee" width={28} height={28} />
                <span className="font-semibold">Handee</span>
              </div>
              <p className="text-sm text-slate-600">Encuentra, conecta, resuelve.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Enlaces</p>
              <ul className="space-y-1 text-sm text-slate-600">
                <li><Link href="/search" className="hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded">Buscar profesionales</Link></li>
                <li><Link href="/postulate" className="hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded">Ofrecer mis servicios</Link></li>
                <li><Link href="/privacy" className="hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded">Aviso de privacidad</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Soporte</p>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>WhatsApp: <a href="https://wa.me/5218181611335" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded">+52 1 81 8161 1335</a></li>
                <li>Email: <a href="mailto:hola@handee.mx" className="hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded">hola@handee.mx</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">© {new Date().getFullYear()} Handee. Todos los derechos reservados.</div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white">
        {icon}
      </div>
      <h3 className="mb-1 font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">{desc}</p>
    </div>
  );
}

function StepCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="absolute -top-3 left-6 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">Paso {step}</div>
      <h3 className="mb-1 font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">{desc}</p>
    </div>
  );
}

/* --- Inline Icons (no external deps) --- */
function MagnifierIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IdCardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="7" y1="8" x2="13" y2="8" />
      <circle cx="8.5" cy="14" r="2" />
      <path d="M12 16c0-1.657 1.79-3 4-3" />
    </svg>
  );
}
function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function StarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polygon points="12 2 15 9 22 9 17 14 19 22 12 18 5 22 7 14 2 9 9 9 12 2" />
    </svg>
  );
}
function PinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
}