import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalLandingTracker from "@/components/analytics/LocalLandingTracker.client";
import Breadcrumbs from "@/components/breadcrumbs";
import LocalLandingCtas from "@/components/seo/LocalLandingCtas.client";
import { Card } from "@/components/ui/card";
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
  const description = `Explora servicios disponibles en ${city.name} y encuentra profesionales para tu hogar con Handi.`;

  return {
    title: `Servicios para hogar en ${city.name}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `Servicios en ${city.name} | Handi`,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Servicios en ${city.name} | Handi`,
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
    name: `Servicios para hogar en ${city.name}`,
    description: `Listado de servicios prioritarios en ${city.name}.`,
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

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
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

      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Ciudades", href: "/ciudades" },
          { label: city.name },
        ]}
      />

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">
          Servicios en {city.name}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Consulta las categorias activas en {city.name}, {city.stateName}, y
          elige la mejor ruta para solicitar apoyo en tu hogar.
        </p>
        <div className="mt-4">
          <LocalLandingCtas landingType="city" citySlug={city.slug} />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Como solicitar un servicio en {city.name}
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-600">
          <li>1. Elige la categoria que mejor describe tu necesidad.</li>
          <li>2. Publica tu solicitud con detalles del trabajo.</li>
          <li>3. Revisa opciones y avanza con la propuesta ideal.</li>
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.length ? (
          services.map((service) => (
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
              <div className="mt-3">
                <Link
                  href={`/servicios/${service.slug}/${city.slug}`}
                  className="text-sm font-semibold text-[#082877] hover:underline"
                >
                  Ver landing local
                </Link>
              </div>
            </Card>
          ))
        ) : (
          <Card className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">
              Aun no hay servicios activos en esta ciudad dentro de la fase 1.
            </p>
          </Card>
        )}
      </section>
    </main>
  );
}
