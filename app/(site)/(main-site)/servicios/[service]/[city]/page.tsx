import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalLandingTracker from "@/components/analytics/LocalLandingTracker.client";
import Breadcrumbs from "@/components/breadcrumbs";
import LocalInfoBand from "@/components/seo/LocalInfoBand";
import LocalLandingCtas from "@/components/seo/LocalLandingCtas.client";
import LocalMarketplaceHero from "@/components/seo/LocalMarketplaceHero";
import MarketplaceCard from "@/components/seo/MarketplaceCard";
import TrustSignalChips from "@/components/seo/TrustSignalChips";
import HowItWorksSection from "@/components/shared/HowItWorksSection";
import ProtectedPaymentsCard from "@/components/shared/ProtectedPaymentsCard";
import { getServiceLandingImage } from "@/lib/seo/landing-images";
import { getAppBaseUrl } from "@/lib/seo/site-url";
import {
  ACTIVE_SERVICE_CITY_COMBINATIONS,
  getLocalLandingEditorial,
  getSeoCityBySlug,
  getSeoServiceBySlug,
  getServicesForCity,
  isActiveServiceCity,
} from "@/lib/seo/local-landings";

type Params = {
  service: string;
  city: string;
};

const SERVICE_CTA_BY_SLUG: Record<string, string> = {
  plomero: "Atiende fugas, destapes e instalaciones con mayor rapidez.",
  electricista: "Resuelve fallas electricas y mejora la seguridad de tu hogar.",
  jardinero: "Recupera y mantiene tus areas verdes con apoyo profesional.",
  carpintero: "Ajusta puertas, muebles y detalles de madera en casa.",
  limpieza: "Organiza limpiezas profundas o recurrentes segun tu necesidad.",
  mozo: "Consigue apoyo practico para tareas generales del hogar.",
};

const CITY_CONTEXT_BY_SLUG: Record<string, string> = {
  monterrey:
    "Monterrey concentra alta demanda en zonas residenciales y areas con actividad diaria intensa.",
  "san-pedro-garza-garcia":
    "San Pedro Garza Garcia suele requerir atencion puntual y coordinacion por colonia.",
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
  const description = `Solicita ${service.keyword} en ${city.name} y recibe opciones verificadas para tu hogar. Cotiza hoy en Handi.`;
  return {
    title: `${service.name} en ${city.name} | Cotiza hoy`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${service.name} en ${city.name} | Cotiza hoy en Handi`,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${service.name} en ${city.name} | Cotiza hoy en Handi`,
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
  const serviceCtaContext =
    SERVICE_CTA_BY_SLUG[service.slug] ||
    "Solicita el servicio con detalles claros para recibir mejores opciones.";
  const cityContext =
    CITY_CONTEXT_BY_SLUG[city.slug] ||
    `${city.name} tiene cobertura activa para solicitudes residenciales en distintas zonas.`;
  const topZones = city.zones.slice(0, 4);
  const topIssue = service.commonIssues[0] || "mantenimiento residencial";
  const landingEditorial = getLocalLandingEditorial(service.slug, city.slug);
  const responseTimeText =
    landingEditorial?.responseTime ||
    "Respuesta habitual en el mismo dia segun zona y horario.";
  const trustSignals = landingEditorial?.trustSignals || [
    "Perfiles verificados con experiencia en hogar.",
    "Comparacion de opciones antes de contratar.",
    "Seguimiento del servicio desde la solicitud.",
  ];
  const localSummary = landingEditorial?.localSummary || cityContext;

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
  const faqItems = landingEditorial?.faq || [
    {
      question: `Como contratar ${service.keyword} en ${city.name}?`,
      answer: `Describe tu necesidad, agrega direccion en ${city.name} y horario estimado, y compara respuestas de profesionales disponibles en zonas como ${topZones.join(", ")}.`,
    },
    {
      question: `Que incluye el servicio de ${service.keyword} en ${city.name}?`,
      answer: `Incluye atencion a tareas frecuentes como ${topIssue.toLowerCase()}, ademas de trabajos relacionados segun el alcance de tu solicitud y la zona donde se realizara el servicio.`,
    },
    {
      question: `Cuanto tarda recibir opciones de ${service.keyword} en ${city.name}?`,
      answer: `Depende del horario y la zona, pero puedes mejorar tiempos indicando referencias de colonia y detalles claros del trabajo desde el inicio.`,
    },
  ];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const heroSignals = ["Verificados", "Respuesta rapida", "Cotizacion clara"];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:space-y-10 md:py-8">
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

      <LocalMarketplaceHero
        eyebrow={`${service.name} en ${city.name}`}
        title={`${service.name} confiable para tu hogar en ${city.name}`}
        subtitle={`${serviceCtaContext} ${localSummary}`}
        quickSignals={heroSignals}
        stickyAside
        imageSrc={getServiceLandingImage(service.slug)}
        imageAlt={`${service.name} en ${city.name}`}
        ctas={
          <div className="space-y-3">
            <LocalLandingCtas
              landingType="service_city"
              serviceSlug={service.slug}
              citySlug={city.slug}
            />
            <Link
              href={`/servicios/${service.slug}`}
              className="inline-flex text-xs font-semibold text-[#082877] hover:underline"
            >
              Ver cobertura de {service.keyword} en otras ciudades
            </Link>
          </div>
        }
        secondaryNote="Compara opciones, define alcance y solicita en minutos."
        aside={
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Decision rapida
            </p>
            <div className="rounded-xl border border-slate-300 bg-gradient-to-b from-white to-slate-50 p-3">
              <p className="text-xs text-slate-500">Respuesta estimada</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {responseTimeText}
              </p>
            </div>
            <div className="rounded-xl border border-slate-300 bg-gradient-to-b from-white to-slate-50 p-3">
              <p className="text-xs text-slate-500">Tipo de servicio</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Servicio residencial
              </p>
            </div>
            <div className="rounded-xl border border-slate-300 bg-gradient-to-b from-white to-slate-50 p-3">
              <p className="text-xs text-slate-500">Cobertura activa</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {topZones.join(", ")}
              </p>
            </div>
          </div>
        }
      />

      <HowItWorksSection className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-white to-[#eef4ff]" />

      <TrustSignalChips
        title="Senales de confianza"
        items={[...trustSignals, ...service.benefits].slice(0, 6)}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <LocalInfoBand
          title={`Zonas atendidas en ${city.name}`}
          description={`Estas colonias y zonas tienen cobertura activa para solicitudes de ${service.keyword}.`}
          chips={city.zones}
        />
        <LocalInfoBand
          title={`Trabajos frecuentes de ${service.keyword}`}
          description="Estos son los escenarios mas solicitados para este servicio en la ciudad."
          chips={service.commonIssues}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Otras opciones en {city.name}
        </h2>
        {cityServices.length ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {cityServices.map((item) => (
              <MarketplaceCard
                key={item.slug}
                title={`${item.name} en ${city.name}`}
                description={item.shortDescription}
                href={`/servicios/${item.slug}/${city.slug}`}
                ctaLabel={`Explorar ${item.keyword} en ${city.name}`}
                badges={[
                  "Cobertura activa",
                  "Servicio residencial",
                  "Cotizacion clara",
                ]}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Pronto agregaremos mas combinaciones para esta ciudad.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Preguntas frecuentes
        </h2>
        <div className="space-y-2">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                <span>{item.question}</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-x-5 gap-y-2 rounded-2xl border border-slate-200 bg-[#f8faff] p-4 md:p-5">
        <Link
          href={`/servicios/${service.slug}`}
          className="text-sm font-semibold text-[#082877] hover:underline"
        >
          Ver {service.name.toLowerCase()} por ciudad
        </Link>
        <Link
          href={`/ciudades/${city.slug}`}
          className="text-sm font-semibold text-[#082877] hover:underline"
        >
          Ver todos los servicios en {city.name}
        </Link>
        <Link
          href="/servicios"
          className="text-sm font-semibold text-[#082877] hover:underline"
        >
          Ir al indice de servicios
        </Link>
      </section>

      <ProtectedPaymentsCard className="bg-transparent" />
    </main>
  );
}
