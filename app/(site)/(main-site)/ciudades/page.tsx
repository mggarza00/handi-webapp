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
import { getAppBaseUrl } from "@/lib/seo/site-url";

export const metadata: Metadata = {
  title: "Ciudades con servicios para el hogar | Monterrey y San Pedro",
  description:
    "Revisa cobertura por ciudad para contratar servicios del hogar. Entra a rutas locales de Monterrey y San Pedro Garza Garcia.",
  alternates: { canonical: "/ciudades" },
  openGraph: {
    title: "Ciudades con servicios para el hogar | Monterrey y San Pedro",
    description:
      "Indice local por ciudad para buscar servicios del hogar en Nuevo Leon.",
    url: "/ciudades",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ciudades con servicios para el hogar | Monterrey y San Pedro",
    description:
      "Explora rutas locales por ciudad y entra directo al servicio que necesitas.",
  },
};

export default function CitiesSeoIndexPage() {
  const baseUrl = getAppBaseUrl();
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Ciudades con cobertura en Handi",
    description:
      "Indice de ciudades con cobertura de servicios para hogar y mantenimiento.",
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
  const priorityCityRoutes = ACTIVE_SERVICE_CITY_COMBINATIONS.slice(0, 10)
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
        eyebrow="Cobertura local"
        title="Ciudades con servicios activos"
        subtitle="Explora cobertura por ciudad y entra a rutas locales para decidir rapido."
        quickSignals={[
          "Monterrey y San Pedro",
          "Rutas por categoria",
          "Cobertura por zonas",
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
              description={`Explora categorias activas en ${city.name} y entra directo a las rutas de contratacion local.`}
              href={`/ciudades/${city.slug}`}
              ctaLabel="Ver servicios por ciudad"
              imageSrc={LANDING_IMAGES.city}
              imageAlt={city.name}
              badges={[
                city.stateName,
                `${serviceCount} servicios activos`,
                `${city.zones.length} zonas destacadas`,
              ]}
            />
          );
        })}
      </section>

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-[#f8faff] p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Rutas locales destacadas
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {priorityCityRoutes.map((item) => (
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
