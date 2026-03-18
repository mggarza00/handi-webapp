import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalLandingTracker from "@/components/analytics/LocalLandingTracker.client";
import Breadcrumbs from "@/components/breadcrumbs";
import LocalLandingCtas from "@/components/seo/LocalLandingCtas.client";
import { Card } from "@/components/ui/card";
import { getAppBaseUrl } from "@/lib/seo/site-url";
import {
  getCitiesForService,
  getSeoServiceBySlug,
  SEO_SERVICES,
} from "@/lib/seo/local-landings";

type Params = { service: string };

export function generateStaticParams(): Params[] {
  return SEO_SERVICES.map((service) => ({ service: service.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const service = getSeoServiceBySlug(params.service);
  if (!service) return { title: "Servicio no encontrado" };
  const canonical = `/servicios/${service.slug}`;
  const description = `${service.shortDescription} ${service.adCopy}`;

  return {
    title: `${service.name} a domicilio en Handi`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${service.name} a domicilio | Handi`,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${service.name} a domicilio | Handi`,
      description,
    },
  };
}

export default function ServiceLandingPage({ params }: { params: Params }) {
  const service = getSeoServiceBySlug(params.service);
  if (!service) notFound();

  const cities = getCitiesForService(service.slug);
  const baseUrl = getAppBaseUrl();
  const canonical = `${baseUrl}/servicios/${service.slug}`;

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
        item: canonical,
      },
    ],
  };

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${service.name} a domicilio`,
    description: service.shortDescription,
    provider: {
      "@type": "Organization",
      name: "Handi",
      url: baseUrl,
    },
    areaServed: cities.map((city) => ({
      "@type": "City",
      name: city.name,
    })),
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <LocalLandingTracker landingType="service" serviceSlug={service.slug} />
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
          { label: service.name },
        ]}
      />

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">
          {service.name} a domicilio
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {service.shortDescription}
        </p>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {service.adCopy}
        </p>
        <div className="mt-4">
          <LocalLandingCtas landingType="service" serviceSlug={service.slug} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">
          Ciudades prioritarias para {service.name.toLowerCase()}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cities.map((city) => (
            <Card
              key={city.slug}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {city.name}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Solicita {service.name.toLowerCase()} en {city.name} con
                profesionales de Handi.
              </p>
              <div className="mt-3">
                <Link
                  href={`/servicios/${service.slug}/${city.slug}`}
                  className="text-sm font-semibold text-[#082877] hover:underline"
                >
                  Ver landing local
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Cobertura y alcance
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Estas rutas priorizan ciudades con demanda activa para mantener mejor
          disponibilidad y tiempos de respuesta.
        </p>
      </section>
    </main>
  );
}
