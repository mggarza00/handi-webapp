import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalLandingTracker from "@/components/analytics/LocalLandingTracker.client";
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
  const description = `Compara opciones de ${service.keyword} para Monterrey y San Pedro Garza Garcia. Elige ciudad, revisa cobertura y cotiza con Handi.`;

  return {
    title: `${service.name} en Monterrey y San Pedro | Elige ciudad`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${service.name} en Monterrey y San Pedro | Elige ciudad`,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${service.name} en Monterrey y San Pedro | Elige ciudad`,
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
    name: `${service.name} en Monterrey y San Pedro`,
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
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:space-y-10 md:py-8">
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

      <LocalMarketplaceHero
        eyebrow={service.name}
        title={`${service.name} en Monterrey y San Pedro`}
        subtitle={`Elige ciudad, compara cobertura local y solicita ${service.keyword} en minutos.`}
        quickSignals={[
          "Cobertura por ciudad",
          "Perfiles verificados",
          "Solicitud simple",
        ]}
        imageSrc={getServiceLandingImage(service.slug)}
        imageAlt={`${service.name} para el hogar`}
        ctas={
          <div className="space-y-3">
            <LocalLandingCtas
              landingType="service"
              serviceSlug={service.slug}
            />
            <Link
              href="/ciudades"
              className="inline-flex text-xs font-semibold text-[#082877] hover:underline"
            >
              Ver ciudades con cobertura
            </Link>
          </div>
        }
        secondaryNote="Elige ciudad, compara alcance y solicita cuando estes listo."
        aside={
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Cobertura activa
            </p>
            <ul className="space-y-2">
              {cities.map((city) => (
                <li
                  key={city.slug}
                  className="rounded-xl border border-slate-300 bg-gradient-to-b from-white to-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  {city.name}
                </li>
              ))}
            </ul>
          </div>
        }
      />

      <HowItWorksSection className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-white to-[#eef4ff]" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Ciudades prioritarias para {service.keyword}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cities.map((city) => (
            <MarketplaceCard
              key={city.slug}
              title={city.name}
              description={`${service.name} en ${city.name}. Revisa cobertura por zona y solicita segun tu horario.`}
              href={`/servicios/${service.slug}/${city.slug}`}
              ctaLabel={`Explorar ${service.keyword} en ${city.name}`}
              imageSrc={LANDING_IMAGES.city}
              imageAlt={`${service.name} en ${city.name}`}
              badges={[
                "Cobertura activa",
                "Servicio residencial",
                `${city.zones.length} zonas destacadas`,
              ]}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Problemas comunes que atiende este servicio
        </h2>
        <ul className="grid gap-2 md:grid-cols-2">
          {service.commonIssues.map((issue) => (
            <li
              key={issue}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
            >
              {issue}
            </li>
          ))}
        </ul>
      </section>

      <p className="rounded-2xl border border-slate-200 bg-[#f8faff] p-4 text-sm text-slate-600 md:p-5">
        Tambien puedes revisar profesionales relacionados en{" "}
        <Link
          href="/professionals"
          className="font-semibold text-[#082877] hover:underline"
        >
          /professionals
        </Link>
        .
      </p>

      <ProtectedPaymentsCard className="bg-transparent" />
    </main>
  );
}
