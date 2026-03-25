import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalLandingTracker from "@/components/analytics/LocalLandingTracker.client";
import Breadcrumbs from "@/components/breadcrumbs";
import LocalLandingCtas from "@/components/seo/LocalLandingCtas.client";
import LocalMarketplaceHero from "@/components/seo/LocalMarketplaceHero";
import MarketplaceCard from "@/components/seo/MarketplaceCard";
import TrustSignalChips from "@/components/seo/TrustSignalChips";
import HowItWorksSection from "@/components/shared/HowItWorksSection";
import ProtectedPaymentsCard from "@/components/shared/ProtectedPaymentsCard";
import {
  LANDING_IMAGES,
  getServiceLandingImage,
} from "@/lib/seo/landing-images";
import { getAppBaseUrl } from "@/lib/seo/site-url";
import {
  getSeoCityBySlug,
  getServicesForCity,
  SEO_CITIES,
} from "@/lib/seo/local-landings";

type Params = { city: string };

export function generateStaticParams(): Params[] {
  return SEO_CITIES.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const city = getSeoCityBySlug(params.city);
  if (!city) return { title: "Ciudad no encontrada" };
  const canonical = `/ciudades/${city.slug}`;
  const description = `Solicita ayuda para tu hogar en ${city.name} con Handi. Comparte tu necesidad, conecta con profesionales compatibles y acuerda por chat dentro de la plataforma.`;

  return {
    title: `Solicita servicios para tu hogar en ${city.name} | Handi`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `Solicita servicios para tu hogar en ${city.name} | Handi`,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Solicita servicios para tu hogar en ${city.name} | Handi`,
      description,
    },
  };
}

export default function CityLandingPage({ params }: { params: Params }) {
  const city = getSeoCityBySlug(params.city);
  if (!city) notFound();

  const services = getServicesForCity(city.slug);
  const baseUrl = getAppBaseUrl();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${baseUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Ciudades",
        item: `${baseUrl}/ciudades`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: city.name,
        item: `${baseUrl}/ciudades/${city.slug}`,
      },
    ],
  };

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Solicitudes para el hogar en ${city.name}`,
    description: `Pagina de cobertura local en ${city.name} para solicitar servicios del hogar y conectar con profesionales compatibles en Handi.`,
    url: `${baseUrl}/ciudades/${city.slug}`,
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: services.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${service.name} en ${city.name}`,
      url: `${baseUrl}/servicios/${service.slug}/${city.slug}`,
    })),
  };
  const cityFaqItems = [
    {
      question: `Como solicito ayuda para mi hogar en ${city.name}?`,
      answer: `Comparte el tipo de trabajo, tu zona en ${city.name} y los detalles clave del problema. Handi te muestra opciones compatibles para continuar por chat y acordar el servicio.`,
    },
    {
      question: `Que informacion conviene incluir en mi solicitud en ${city.name}?`,
      answer:
        "Incluye alcance del trabajo, referencias del domicilio, horario estimado y fotos cuando aplique. Eso ayuda a recibir respuestas mas precisas y comparables.",
    },
    {
      question: `Como avanzo con profesionales compatibles en ${city.name}?`,
      answer:
        "Despues de enviar tu solicitud, puedes conversar por chat, aclarar dudas y cerrar el acuerdo dentro de Handi segun disponibilidad en tu zona.",
    },
  ];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cityFaqItems.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:space-y-10 md:py-8">
      <LocalLandingTracker landingType="city" citySlug={city.slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      {services.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Ciudades", href: "/ciudades" },
          { label: city.name },
        ]}
      />

      <LocalMarketplaceHero
        eyebrow={`Operacion local en ${city.name}`}
        title={`Solicita ayuda para tu hogar en ${city.name}`}
        subtitle={`Handi conecta tu necesidad con profesionales compatibles en cobertura activa para que avances por chat hasta cerrar un acuerdo.`}
        quickSignals={[
          "Cobertura activa por zonas",
          "Compatibilidad por solicitud",
          "Acuerdo dentro de Handi",
        ]}
        imageSrc={LANDING_IMAGES.city}
        imageAlt={`Servicios para el hogar en ${city.name}`}
        ctas={
          <div className="space-y-3">
            <LocalLandingCtas landingType="city" citySlug={city.slug} />
            <Link
              href="/servicios"
              className="inline-flex text-xs font-semibold text-[#082877] hover:underline"
            >
              Ver tipos de solicitudes disponibles
            </Link>
          </div>
        }
        aside={
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Zonas con operacion activa
            </p>
            <ul className="space-y-2">
              {city.zones.slice(0, 5).map((zone) => (
                <li
                  key={zone}
                  className="rounded-xl border border-slate-300 bg-gradient-to-b from-white to-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  {zone}
                </li>
              ))}
            </ul>
          </div>
        }
      />

      <HowItWorksSection className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-white to-[#eef4ff]" />

      <TrustSignalChips
        title={`Como te ayuda Handi en ${city.name}`}
        items={[
          "Solicitud guiada para tu necesidad real",
          "Opciones compatibles segun zona y alcance",
          "Comunicacion y acuerdo por chat",
        ]}
      />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Tipos de solicitudes que puedes hacer en {city.name}
        </h2>
        {services.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <MarketplaceCard
                key={service.slug}
                title={service.name}
                description={service.shortDescription}
                href={`/servicios/${service.slug}/${city.slug}`}
                ctaLabel={`Solicitar ${service.keyword} en ${city.name}`}
                imageSrc={getServiceLandingImage(service.slug)}
                imageAlt={`${service.name} en ${city.name}`}
                badges={[
                  "Servicio residencial",
                  "Cobertura activa",
                  "Profesionales compatibles",
                ]}
              />
            ))}
          </div>
        ) : (
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-600">
              Aun no hay solicitudes disponibles en esta ciudad dentro de la
              fase actual de operacion.
            </p>
          </article>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Preguntas frecuentes sobre solicitudes en {city.name}
        </h2>
        <div className="space-y-2">
          {cityFaqItems.map((item) => (
            <details
              key={item.question}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                {item.question}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <ProtectedPaymentsCard className="bg-transparent" />
    </main>
  );
}
