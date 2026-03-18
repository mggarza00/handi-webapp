import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalLandingTracker from "@/components/analytics/LocalLandingTracker.client";
import Breadcrumbs from "@/components/breadcrumbs";
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
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:py-8">
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

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">
          {service.name} a domicilio
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          {service.shortDescription} {service.adCopy}
        </p>
        <p className="text-sm text-slate-600">
          Explora ciudades disponibles para este servicio:
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cities.map((city) => (
          <article
            key={city.slug}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <h2 className="text-base font-semibold text-slate-900">
              {city.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {service.name} en {city.name}
            </p>
            <div className="mt-3">
              <Link
                href={`/servicios/${service.slug}/${city.slug}`}
                className="text-sm font-semibold text-[#082877] hover:underline"
              >
                Ver opciones en {city.name}
              </Link>
            </div>
          </article>
        ))}
      </section>

      <p className="text-sm text-slate-600">
        Tambien puedes revisar profesionales relacionados en{" "}
        <Link
          href="/professionals"
          className="font-semibold text-[#082877] hover:underline"
        >
          /professionals
        </Link>
        .
      </p>
    </main>
  );
}
