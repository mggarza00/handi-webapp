import type { Metadata } from "next";
import Link from "next/link";

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
import {
  ACTIVE_SERVICE_CITY_COMBINATIONS,
  SEO_SERVICES,
  getCitiesForService,
  getSeoCityBySlug,
} from "@/lib/seo/local-landings";
import { SEO_PRICE_PAGES, SEO_PROBLEM_PAGES } from "@/lib/seo/seo-pages";
import { getAppBaseUrl } from "@/lib/seo/site-url";

export const metadata: Metadata = {
  title: "Solicita servicios para tu hogar con Handi | Monterrey y San Pedro",
  description:
    "Cuéntanos qué necesitas en tu hogar y Handi te conecta con profesionales compatibles para conversar y acordar dentro de la plataforma.",
  alternates: { canonical: "/servicios" },
  openGraph: {
    title: "Solicita servicios para tu hogar con Handi | Monterrey y San Pedro",
    description:
      "Solicita trabajos del hogar en Handi y encuentra profesionales compatibles para resolver tu caso con seguimiento en plataforma.",
    url: "/servicios",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Solicita servicios para tu hogar con Handi | Monterrey y San Pedro",
    description:
      "Desde plomería hasta limpieza, crea tu solicitud, habla con profesionales compatibles y cierra tu acuerdo en Handi.",
  },
};

export default function ServicesSeoIndexPage() {
  const baseUrl = getAppBaseUrl();
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Tipos de servicios para el hogar en Handi",
    description:
      "Página de referencia para solicitar ayuda en trabajos del hogar y conectar con profesionales compatibles en Handi.",
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
  const commonServiceRequests = ACTIVE_SERVICE_CITY_COMBINATIONS.slice(0, 8)
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
  const featuredProblemLinks = SEO_PROBLEM_PAGES.slice(0, 5).map((item) => ({
    href: `/problemas/${item.slug}`,
    label: item.linkLabel,
  }));
  const featuredPriceLinks = SEO_PRICE_PAGES.slice(0, 5).map((item) => ({
    href: `/precios/${item.slug}`,
    label: item.linkLabel,
  }));

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:space-y-10 md:py-8">
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

      <LocalMarketplaceHero
        eyebrow="Solicitudes para tu hogar"
        title="¿Qué necesitas resolver en casa?"
        subtitle="Elige el tipo de trabajo, cuéntanos tu caso y conecta con profesionales compatibles para acordar dentro de Handi."
        quickSignals={[
          "Solicitud guiada en minutos",
          "Profesionales compatibles",
          "Acuerdo y seguimiento en plataforma",
        ]}
        imageSrc={LANDING_IMAGES.platform}
        imageAlt="Plataforma Handi para servicios del hogar"
        ctas={
          <div className="space-y-3">
            <LocalLandingCtas
              landingType="service"
              authLabel="Solicitar servicio"
              unauthLabel="Registrarme y solicitar servicio"
            />
          </div>
        }
      />

      <HowItWorksSection className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-white to-[#eef4ff]" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Tipos de trabajo que puedes solicitar
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SEO_SERVICES.map((service) => {
            const cityCount = getCitiesForService(service.slug).length;
            return (
              <MarketplaceCard
                key={service.slug}
                title={service.name}
                description={service.shortDescription}
                href={`/servicios/${service.slug}`}
                ctaLabel="Solicitar este tipo de trabajo"
                imageSrc={getServiceLandingImage(service.slug)}
                imageAlt={service.name}
                badges={[
                  `${cityCount} zonas con operación activa`,
                  "Servicio residencial",
                  "Conexión con profesionales compatibles",
                ]}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-[#f8faff] p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Solicitudes frecuentes
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {commonServiceRequests.map((item) => (
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

      <section className="grid gap-4 md:grid-cols-2">
        <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Problemas comunes del hogar
          </h2>
          <p className="text-sm text-slate-600">
            Guías prácticas para solicitar ayuda con contexto claro y recibir
            opciones compatibles.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {featuredProblemLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-[#082877] hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </article>
        <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Precios estimados
          </h2>
          <p className="text-sm text-slate-600">
            Referencias orientativas para solicitar con mejor informacion y
            acordar sin friccion.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {featuredPriceLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-[#082877] hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </article>
      </section>

      <ProtectedPaymentsCard className="bg-transparent" />
    </main>
  );
}
