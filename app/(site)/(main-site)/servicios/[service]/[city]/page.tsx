import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalLandingTracker from "@/components/analytics/LocalLandingTracker.client";
import Breadcrumbs from "@/components/breadcrumbs";
import LocalLandingCtas from "@/components/seo/LocalLandingCtas.client";
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
  const processSteps = landingEditorial?.processSteps || [
    "Describe la necesidad con detalles claros.",
    "Compara opciones disponibles en tu zona.",
    "Coordina visita y confirma alcance del servicio.",
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

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-slate-900">
          {service.name} en {city.name}
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Solicita {service.keyword} en {city.name}, {city.stateName}, y conecta
          con profesionales verificados para resolver necesidades de hogar con
          mayor rapidez.
        </p>
        <p className="max-w-3xl text-sm text-slate-600">{serviceCtaContext}</p>
        <p className="max-w-3xl text-sm text-slate-600">{localSummary}</p>
        <p className="max-w-3xl text-sm text-slate-600">
          Tiempo de respuesta estimado: {responseTimeText}
        </p>
        <div className="pt-1">
          <LocalLandingCtas
            landingType="service_city"
            serviceSlug={service.slug}
            citySlug={city.slug}
          />
        </div>
        <p className="text-xs text-slate-500">
          Compara opciones, define alcance y solicita cotizacion en minutos.
        </p>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">
            Senales de confianza
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            {[...service.benefits, ...trustSignals]
              .slice(0, 5)
              .map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
          </ul>
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">
            Proceso simple de contratacion
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            {processSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Zonas atendidas en {city.name}
        </h2>
        <p className="text-sm text-slate-600">
          Estas colonias y zonas tienen mayor cobertura para solicitudes de{" "}
          {service.keyword}.
        </p>
        <div className="flex flex-wrap gap-2">
          {city.zones.map((zone) => (
            <span
              key={zone}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
            >
              {zone}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Problemas frecuentes de {service.keyword} en {city.name}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          {service.commonIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </section>

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

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Explora mas rutas locales
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link
            href={`/servicios/${service.slug}`}
            className="text-sm font-medium text-[#082877] hover:underline"
          >
            Ver {service.name.toLowerCase()} por ciudad
          </Link>
          <Link
            href={`/ciudades/${city.slug}`}
            className="text-sm font-medium text-[#082877] hover:underline"
          >
            Ver todos los servicios en {city.name}
          </Link>
          <Link
            href="/servicios"
            className="text-sm font-medium text-[#082877] hover:underline"
          >
            Ir al indice de servicios
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Preguntas frecuentes
        </h2>
        <div className="space-y-2">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <summary className="cursor-pointer text-sm font-medium text-slate-900">
                {item.question}
              </summary>
              <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
