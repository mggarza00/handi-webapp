import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalLandingTracker from "@/components/analytics/LocalLandingTracker.client";
import Breadcrumbs from "@/components/breadcrumbs";
import CampaignFaq from "@/components/seo/CampaignFaq.client";
import CampaignTrustSection from "@/components/seo/CampaignTrustSection";
import LocalLandingCtas from "@/components/seo/LocalLandingCtas.client";
import { Card } from "@/components/ui/card";
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

  const faqs = [
    {
      question: `Que incluye ${service.name.toLowerCase()} en ${city.name}?`,
      answer:
        "Incluye solicitudes para diagnostico, reparacion, mantenimiento y servicios relacionados segun tu necesidad especifica.",
    },
    {
      question: "Cuanto tarda recibir respuestas?",
      answer:
        "Depende de la demanda en la zona, pero la plataforma esta enfocada en conectar rapido con profesionales disponibles.",
    },
    {
      question: "Como comparar opciones antes de elegir?",
      answer:
        "Revisa perfil, experiencia, resenas y detalle de servicio para decidir con mayor confianza.",
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Servicios", href: "/servicios" },
          { label: service.name, href: `/servicios/${service.slug}` },
          { label: city.name },
        ]}
      />

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">
          {service.name} en {city.name}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Solicita {service.name.toLowerCase()} en {city.name}, {city.stateName}
          , y conecta con profesionales verificados de Handi.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {service.adCopy}
        </p>
        <div className="mt-4">
          <LocalLandingCtas
            landingType="service_city"
            serviceSlug={service.slug}
            citySlug={city.slug}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Como funciona en Handi
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Describe tu necesidad en el formulario de solicitud.</li>
            <li>2. Recibe respuestas de profesionales en tu zona.</li>
            <li>3. Compara opciones y avanza con la mejor propuesta.</li>
          </ol>
          <p className="mt-3 text-sm text-slate-600">
            Esta ruta local esta optimizada para usuarios que buscan{" "}
            {service.name.toLowerCase()} en {city.name}.
          </p>
        </Card>
        <CampaignTrustSection
          pageType="service_city_landing"
          sectionId="service-city-trust"
          serviceSlug={service.slug}
          citySlug={city.slug}
          title={`Confianza para ${service.name.toLowerCase()} en ${city.name}`}
          points={[
            "Perfiles publicos para comparar experiencia y resenas.",
            "Proceso guiado para publicar y evaluar propuestas.",
            "Flujo de contratacion con pagos protegidos.",
          ]}
        />
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Otras opciones en {city.name}
        </h2>
        <div className="mt-3 space-y-2">
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

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Preguntas frecuentes en {city.name}
        </h2>
        <div className="mt-3">
          <CampaignFaq
            pageType="service_city_landing"
            serviceSlug={service.slug}
            citySlug={city.slug}
            items={faqs}
          />
        </div>
      </section>
    </main>
  );
}
