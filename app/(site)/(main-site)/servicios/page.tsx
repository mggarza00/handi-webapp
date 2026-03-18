import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumbs from "@/components/breadcrumbs";
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
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:py-8">
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

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">
          Servicios para tu hogar
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Explora servicios disponibles y entra a su indice por ciudad para
          encontrar opciones mas rapido.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SEO_SERVICES.map((service) => {
          const cityCount = getCitiesForService(service.slug).length;
          return (
            <article
              key={service.slug}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <h2 className="text-base font-semibold text-slate-900">
                {service.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {service.shortDescription}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Disponible en {cityCount} ciudades prioritarias.
              </p>
              <div className="mt-3">
                <Link
                  href={`/servicios/${service.slug}`}
                  className="text-sm font-semibold text-[#082877] hover:underline"
                >
                  Ver ciudades para este servicio
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
