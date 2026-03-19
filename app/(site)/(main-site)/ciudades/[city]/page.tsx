import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalLandingTracker from "@/components/analytics/LocalLandingTracker.client";
import Breadcrumbs from "@/components/breadcrumbs";
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
  const description = `Encuentra servicios para el hogar en ${city.name}. Explora opciones por categoria y entra a la ruta local de contratacion.`;

  return {
    title: `Servicios para el hogar en ${city.name} | Handi`,
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
  const cityFaqItems = [
    {
      question: `Que servicios del hogar puedo solicitar en ${city.name}?`,
      answer:
        "Puedes solicitar trabajos de plomeria, electricidad, jardineria, carpinteria, limpieza y apoyo general segun disponibilidad.",
    },
    {
      question: `Como elijo el servicio correcto en ${city.name}?`,
      answer:
        "Entra a la ruta del servicio y ciudad para ver alcance, zonas atendidas y opciones recomendadas antes de solicitar.",
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
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:py-8">
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

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">
          Servicios en {city.name}
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Consulta las categorias activas en {city.name}, {city.stateName}, y
          entra directo a cada servicio por ciudad.
        </p>
        <p className="text-sm text-slate-600">
          Zonas con mayor demanda: {city.zones.slice(0, 4).join(", ")}.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {services.length ? (
          services.map((service) => (
            <Card
              key={service.slug}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <h2 className="text-base font-semibold text-slate-900">
                {service.name}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {service.shortDescription}
              </p>
              <div className="mt-3">
                <Link
                  href={`/servicios/${service.slug}/${city.slug}`}
                  className="text-sm font-semibold text-[#082877] hover:underline"
                >
                  Ver opciones en {city.name}
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Preguntas frecuentes en {city.name}
        </h2>
        <div className="space-y-2">
          {cityFaqItems.map((item) => (
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
