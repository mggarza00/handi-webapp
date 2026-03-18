import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalLandingTracker from "@/components/analytics/LocalLandingTracker.client";
import Breadcrumbs from "@/components/breadcrumbs";
import LocalLandingCtas from "@/components/seo/LocalLandingCtas.client";
import { getAppBaseUrl } from "@/lib/seo/site-url";
import {
  ACTIVE_SERVICE_CITY_COMBINATIONS,
  getSeoCityBySlug,
  getSeoServiceBySlug,
  getServicesForCity,
  isActiveServiceCity,
} from "@/lib/seo/local-landings";

type Params = {
  service: string;
  city: string;
};

export function generateStaticParams(): Params[] {
  return ACTIVE_SERVICE_CITY_COMBINATIONS.map((item) => ({
    service: item.serviceSlug,
    city: item.citySlug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const service = getSeoServiceBySlug(params.service);
  const city = getSeoCityBySlug(params.city);
  if (!service || !city || !isActiveServiceCity(service.slug, city.slug)) {
    return { title: "Landing no encontrada" };
  }
  const canonical = `/servicios/${service.slug}/${city.slug}`;
  const description = `Solicita ${service.name.toLowerCase()} en ${city.name}. ${service.adCopy}`;
  return {
    title: `${service.name} en ${city.name} | Solicita en Handi`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${service.name} en ${city.name} | Handi`,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${service.name} en ${city.name} | Handi`,
      description,
    },
  };
}

export default function LocalServiceCityLandingPage({
  params,
}: {
  params: Params;
}) {
  const service = getSeoServiceBySlug(params.service);
  const city = getSeoCityBySlug(params.city);
  if (!service || !city || !isActiveServiceCity(service.slug, city.slug)) {
    notFound();
  }

  const baseUrl = getAppBaseUrl();
  const canonical = `${baseUrl}/servicios/${service.slug}/${city.slug}`;
  const cityServices = getServicesForCity(city.slug).filter(
    (item) => item.slug !== service.slug,
  );

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${baseUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Servicios",
        item: `${baseUrl}/servicios`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: service.name,
        item: `${baseUrl}/servicios/${service.slug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: city.name,
        item: canonical,
      },
    ],
  };

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${service.name} en ${city.name}`,
    description: service.shortDescription,
    areaServed: {
      "@type": "City",
      name: city.name,
    },
    provider: {
      "@type": "Organization",
      name: "Handi",
      url: baseUrl,
    },
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:py-8">
      <LocalLandingTracker
        landingType="service_city"
        serviceSlug={service.slug}
        citySlug={city.slug}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Servicios", href: "/servicios" },
          { label: service.name, href: `/servicios/${service.slug}` },
          { label: city.name },
        ]}
      />

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-slate-900">
          {service.name} en {city.name}
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Solicita {service.name.toLowerCase()} en {city.name}, {city.stateName}
          , y conecta con profesionales verificados.
        </p>
        <p className="max-w-3xl text-sm text-slate-600">{service.adCopy}</p>
        <div className="pt-1">
          <LocalLandingCtas
            landingType="service_city"
            serviceSlug={service.slug}
            citySlug={city.slug}
          />
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Describe tu necesidad y presupuesto.</li>
          <li>Recibe respuestas de profesionales en tu zona.</li>
          <li>Compara opciones y avanza con la mejor propuesta.</li>
        </ul>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">
          Otras opciones en {city.name}
        </h2>
        <div className="space-y-2">
          {cityServices.length ? (
            cityServices.map((item) => (
              <Link
                key={item.slug}
                href={`/servicios/${item.slug}/${city.slug}`}
                className="block text-sm font-medium text-[#082877] hover:underline"
              >
                {item.name} en {city.name}
              </Link>
            ))
          ) : (
            <p className="text-sm text-slate-600">
              Pronto agregaremos mas combinaciones para esta ciudad.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
