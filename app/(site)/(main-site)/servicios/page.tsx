import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumbs from "@/components/breadcrumbs";
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
          ciudad.
        </p>
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
