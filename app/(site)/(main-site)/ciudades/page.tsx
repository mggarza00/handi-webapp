import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumbs from "@/components/breadcrumbs";
import CampaignCtaGroup from "@/components/seo/CampaignCtaGroup.client";
import CampaignTrustSection from "@/components/seo/CampaignTrustSection";
import { Card } from "@/components/ui/card";
import { SEO_CITIES, getServicesForCity } from "@/lib/seo/local-landings";
import { getAppBaseUrl } from "@/lib/seo/site-url";

export const metadata: Metadata = {
  title: "Ciudades con cobertura",
  description:
    "Revisa ciudades con cobertura inicial en Handi y encuentra servicios para el hogar por zona.",
  alternates: { canonical: "/ciudades" },
  openGraph: {
    title: "Ciudades con cobertura | Handi",
    description:
      "Revisa ciudades con cobertura inicial en Handi y encuentra servicios para el hogar por zona.",
    url: "/ciudades",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ciudades con cobertura | Handi",
    description:
      "Revisa ciudades con cobertura inicial en Handi y encuentra servicios para el hogar por zona.",
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

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
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

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">
          Ciudades con cobertura inicial
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Esta base de landings locales se enfoca en ciudades prioritarias para
          crecimiento organico y campanas de Google Ads.
        </p>
        <div className="mt-4">
          <CampaignCtaGroup
            trackingContext={{ pageType: "cities_index", placement: "hero" }}
            primary={{ label: "Solicitar servicio", href: "/requests/new" }}
            secondary={{ label: "Explorar servicios", href: "/servicios" }}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Cobertura inicial
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Esta fase prioriza zonas con mayor demanda para servicios de hogar.
          </p>
        </Card>
        <CampaignTrustSection
          pageType="cities_index"
          sectionId="cities-index-trust"
          title="Servicios y confianza"
          points={[
            "Rutas directas por ciudad para reducir pasos.",
            "Categorias activas con CTA de conversion claros.",
            "Perfiles de profesionales disponibles por zona.",
          ]}
        />
        <Card className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Escalabilidad
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            La estructura permite ampliar ciudades y servicios sin rehacer
            rutas.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SEO_CITIES.map((city) => {
          const serviceCount = getServicesForCity(city.slug).length;
          return (
            <Card
              key={city.slug}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-slate-900">
                {city.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{city.stateName}</p>
              <p className="mt-2 text-xs text-slate-500">
                {serviceCount} servicios activos en esta fase.
              </p>
              <div className="mt-4">
                <Link
                  href={`/ciudades/${city.slug}`}
                  className="text-sm font-semibold text-[#082877] hover:underline"
                >
                  Ver servicios por ciudad
                </Link>
              </div>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
