import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumbs from "@/components/breadcrumbs";
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
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:py-8">
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

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">
          Servicios para tu hogar
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Explora servicios por especialidad y entra a cada ruta local para
          contratar en Monterrey y San Pedro Garza Garcia.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SEO_SERVICES.map((service) => {
          const cityCount = getCitiesForService(service.slug).length;
          return (
            <article
              key={service.slug}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <h2 className="text-base font-semibold text-slate-900">
                {service.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {service.shortDescription}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Disponible en {cityCount} ciudades prioritarias.
              </p>
              <div className="mt-3">
                <Link
                  href={`/servicios/${service.slug}`}
                  className="text-sm font-semibold text-[#082877] hover:underline"
                >
                  Ver ciudades para este servicio
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="space-y-2">
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
    </main>
  );
}
