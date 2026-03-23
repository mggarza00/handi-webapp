import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumbs from "@/components/breadcrumbs";
import LocalLandingCtas from "@/components/seo/LocalLandingCtas.client";
import LocalMarketplaceHero from "@/components/seo/LocalMarketplaceHero";
import MarketplaceCard from "@/components/seo/MarketplaceCard";
import HowItWorksSection from "@/components/shared/HowItWorksSection";
import ProtectedPaymentsCard from "@/components/shared/ProtectedPaymentsCard";
import {
  LANDING_IMAGES,
  getServiceLandingImage,
} from "@/lib/seo/landing-images";
import {
  ACTIVE_SERVICE_CITY_COMBINATIONS,
  SEO_SERVICES,
  getCitiesForService,
  getSeoCityBySlug,
} from "@/lib/seo/local-landings";
import { getAppBaseUrl } from "@/lib/seo/site-url";

export const metadata: Metadata = {
  title: "Servicios para el hogar en Monterrey y San Pedro | Cotiza hoy",
  description:
    "Encuentra plomero, electricista, jardinero, carpintero, limpieza y mozo en Monterrey y San Pedro. Elige servicio y cotiza en minutos.",
  alternates: { canonical: "/servicios" },
  openGraph: {
    title: "Servicios para el hogar en Monterrey y San Pedro | Cotiza hoy",
    description:
      "Indice local para contratar profesionales del hogar en Monterrey y San Pedro Garza Garcia.",
    url: "/servicios",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Servicios para el hogar en Monterrey y San Pedro | Cotiza hoy",
    description:
      "Explora servicios locales y entra a rutas por ciudad para contratar mas rapido.",
  },
};

export default function ServicesSeoIndexPage() {
  const baseUrl = getAppBaseUrl();
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Servicios para el hogar en Handi",
    description:
      "Indice de servicios para solicitudes y cotizaciones de mantenimiento del hogar.",
    url: `${baseUrl}/servicios`,
  };
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: SEO_SERVICES.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: service.name,
      url: `${baseUrl}/servicios/${service.slug}`,
    })),
  };
  const popularLocalSearches = ACTIVE_SERVICE_CITY_COMBINATIONS.slice(0, 8)
    .map((combo) => {
      const service = SEO_SERVICES.find(
        (item) => item.slug === combo.serviceSlug,
      );
      const city = getSeoCityBySlug(combo.citySlug);
      if (!service || !city) return null;
      return {
        href: `/servicios/${service.slug}/${city.slug}`,
        label: `${service.keyword} en ${city.name}`,
      };
    })
    .filter((item): item is { href: string; label: string } => Boolean(item));

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
        items={[{ label: "Inicio", href: "/" }, { label: "Servicios" }]}
      />

      <LocalMarketplaceHero
        eyebrow="Marketplace Handi"
        title="Servicios para tu hogar"
        subtitle="Explora categorias, compara cobertura local y elige rapido el servicio ideal para tu hogar."
        quickSignals={[
          "Cobertura en Monterrey y San Pedro",
          "Categorias verificadas",
          "Solicitud directa",
        ]}
        imageSrc={LANDING_IMAGES.platform}
        imageAlt="Plataforma Handi para servicios del hogar"
        ctas={
          <div className="space-y-3">
            <LocalLandingCtas
              landingType="service"
              authLabel="Solicitar servicio"
              unauthLabel="Registrarme y solicitar servicio"
            />
          </div>
        }
      />

      <HowItWorksSection className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-white to-[#eef4ff]" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Elige una categoria
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SEO_SERVICES.map((service) => {
            const cityCount = getCitiesForService(service.slug).length;
            return (
              <MarketplaceCard
                key={service.slug}
                title={service.name}
                description={service.shortDescription}
                href={`/servicios/${service.slug}`}
                ctaLabel="Ver ciudades para este servicio"
                imageSrc={getServiceLandingImage(service.slug)}
                imageAlt={service.name}
                badges={[
                  `${cityCount} ciudades prioritarias`,
                  "Servicio residencial",
                  "Comparacion de opciones",
                ]}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-[#f8faff] p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Busquedas locales populares
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {popularLocalSearches.map((item) => (
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

      <ProtectedPaymentsCard className="bg-transparent" />
    </main>
  );
}
