import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumbs from "@/components/breadcrumbs";
import LocalMarketplaceHero from "@/components/seo/LocalMarketplaceHero";
import MarketplaceCard from "@/components/seo/MarketplaceCard";
import HowItWorksSection from "@/components/shared/HowItWorksSection";
import ProtectedPaymentsCard from "@/components/shared/ProtectedPaymentsCard";
import { LANDING_IMAGES } from "@/lib/seo/landing-images";
import {
  ACTIVE_SERVICE_CITY_COMBINATIONS,
  SEO_CITIES,
  getSeoServiceBySlug,
  getServicesForCity,
} from "@/lib/seo/local-landings";
import { SEO_PRICE_PAGES, SEO_PROBLEM_PAGES } from "@/lib/seo/seo-pages";
import { getAppBaseUrl } from "@/lib/seo/site-url";

export const metadata: Metadata = {
  title: "Cobertura local de Handi | Monterrey y San Pedro",
  description:
    "Conoce dónde opera Handi y cómo conectamos solicitudes del hogar con profesionales compatibles en tu zona.",
  alternates: { canonical: "/ciudades" },
  openGraph: {
    title: "Cobertura local de Handi | Monterrey y San Pedro",
    description:
      "Consulta la cobertura activa de Handi en Monterrey y San Pedro para solicitar servicios del hogar con atención local.",
    url: "/ciudades",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cobertura local de Handi | Monterrey y San Pedro",
    description:
      "Revisa zonas de operación activa y solicita ayuda para tu hogar con profesionales compatibles en Handi.",
  },
};

export default function CitiesSeoIndexPage() {
  const baseUrl = getAppBaseUrl();
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Cobertura local de Handi",
    description:
      "Información de cobertura local para solicitudes de servicios del hogar en Handi.",
    url: `${baseUrl}/ciudades`,
  };
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: SEO_CITIES.map((city, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: city.name,
      url: `${baseUrl}/ciudades/${city.slug}`,
    })),
  };
  const commonRequestsByZone = ACTIVE_SERVICE_CITY_COMBINATIONS.slice(0, 10)
    .map((combo) => {
      const service = getSeoServiceBySlug(combo.serviceSlug);
      const city = SEO_CITIES.find((item) => item.slug === combo.citySlug);
      if (!service || !city) return null;
      return {
        href: `/servicios/${service.slug}/${city.slug}`,
        label: `${service.keyword} en ${city.name}`,
      };
    })
    .filter((item): item is { href: string; label: string } => Boolean(item));
  const featuredProblemLinks = SEO_PROBLEM_PAGES.slice(0, 5).map((item) => ({
    href: `/problemas/${item.slug}`,
    label: item.linkLabel,
  }));
  const featuredPriceLinks = SEO_PRICE_PAGES.slice(0, 5).map((item) => ({
    href: `/precios/${item.slug}`,
    label: item.linkLabel,
  }));

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:space-y-10 md:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <Breadcrumbs
        items={[{ label: "Inicio", href: "/" }, { label: "Ciudades" }]}
      />

      <LocalMarketplaceHero
        eyebrow="Operación local Handi"
        title="¿En qué zonas opera Handi?"
        subtitle="Trabajamos por cobertura local para conectar tu solicitud con profesionales compatibles y resolver dentro de la plataforma."
        quickSignals={[
          "Cobertura activa por zonas",
          "Conexión según tu necesidad",
          "Seguimiento local del servicio",
        ]}
        imageSrc={LANDING_IMAGES.city}
        imageAlt="Cobertura de servicios por ciudad"
        ctas={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/servicios"
              className="inline-flex items-center justify-center rounded-full bg-[#082877] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d3a9c]"
            >
              Ver servicios
            </Link>
          </div>
        }
      />

      <HowItWorksSection className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-white to-[#eef4ff]" />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SEO_CITIES.map((city) => {
          const serviceCount = getServicesForCity(city.slug).length;
          return (
            <MarketplaceCard
              key={city.slug}
              title={city.name}
              description={`Conoce cómo solicitar ayuda para tu hogar en ${city.name} y recibir opciones compatibles en cobertura activa.`}
              href={`/ciudades/${city.slug}`}
              ctaLabel="Ver cobertura y solicitudes locales"
              imageSrc={LANDING_IMAGES.city}
              imageAlt={city.name}
              badges={[
                city.stateName,
                `${serviceCount} tipos de servicio operando`,
                `${city.zones.length} zonas destacadas`,
              ]}
            />
          );
        })}
      </section>

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-[#f8faff] p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Solicitudes comunes por zona
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {commonRequestsByZone.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[#082877] hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Problemas comunes por zona
          </h2>
          <p className="text-sm text-slate-600">
            Contenido enfocado en necesidades reales para solicitar mejor en
            Handi.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {featuredProblemLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-[#082877] hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </article>
        <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Precios estimados en contexto real
          </h2>
          <p className="text-sm text-slate-600">
            Rangos orientativos para planear mejor tu solicitud antes de
            acordar.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {featuredPriceLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-[#082877] hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </article>
      </section>

      <ProtectedPaymentsCard className="bg-transparent" />
    </main>
  );
}
