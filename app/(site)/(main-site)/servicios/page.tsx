import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumbs from "@/components/breadcrumbs";
import CampaignCtaGroup from "@/components/seo/CampaignCtaGroup.client";
import CampaignTrustSection from "@/components/seo/CampaignTrustSection";
import { Card } from "@/components/ui/card";
import { SEO_SERVICES, getCitiesForService } from "@/lib/seo/local-landings";
import { getAppBaseUrl } from "@/lib/seo/site-url";

export const metadata: Metadata = {
  title: "Servicios para el hogar",
  description:
    "Explora servicios para el hogar en Handi y encuentra profesionales para plomeria, electricidad, limpieza, pintura y reparaciones.",
  alternates: { canonical: "/servicios" },
  openGraph: {
    title: "Servicios para el hogar | Handi",
    description:
      "Explora servicios para el hogar en Handi y encuentra profesionales para plomeria, electricidad, limpieza, pintura y reparaciones.",
    url: "/servicios",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Servicios para el hogar | Handi",
    description:
      "Explora servicios para el hogar en Handi y encuentra profesionales para plomeria, electricidad, limpieza, pintura y reparaciones.",
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

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
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

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">
          Servicios para tu hogar
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Encuentra servicios por tipo de necesidad y compara opciones en tu
          ciudad. Esta seccion esta pensada para ayudarte a llegar mas rapido al
          flujo de solicitud.
        </p>
        <div className="mt-4">
          <CampaignCtaGroup
            trackingContext={{ pageType: "services_index", placement: "hero" }}
            primary={{ label: "Solicitar servicio", href: "/requests/new" }}
            secondary={{ label: "Ver profesionales", href: "/professionals" }}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Como funciona
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Crea una solicitud, recibe respuestas y elige la opcion que mejor se
            ajuste a tu servicio.
          </p>
        </Card>
        <CampaignTrustSection
          pageType="services_index"
          sectionId="services-index-trust"
          title="Confianza"
          points={[
            "Perfiles publicos con experiencia y resenas.",
            "Flujo claro para publicar solicitud y comparar respuestas.",
            "Pagos protegidos en el proceso de contratacion.",
          ]}
        />
        <Card className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Cobertura</h2>
          <p className="mt-2 text-sm text-slate-600">
            Empezamos con ciudades prioritarias y seguiremos ampliando servicios
            locales.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SEO_SERVICES.map((service) => {
          const cityCount = getCitiesForService(service.slug).length;
          return (
            <Card
              key={service.slug}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-slate-900">
                {service.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {service.shortDescription}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Disponible en {cityCount} ciudades prioritarias.
              </p>
              <div className="mt-4">
                <Link
                  href={`/servicios/${service.slug}`}
                  className="text-sm font-semibold text-[#082877] hover:underline"
                >
                  Ver landing del servicio
                </Link>
              </div>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
