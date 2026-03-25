import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumbs from "@/components/breadcrumbs";
import LocalLandingCtas from "@/components/seo/LocalLandingCtas.client";
import LocalMarketplaceHero from "@/components/seo/LocalMarketplaceHero";
import TrustSignalChips from "@/components/seo/TrustSignalChips";
import HowItWorksSection from "@/components/shared/HowItWorksSection";
import ProtectedPaymentsCard from "@/components/shared/ProtectedPaymentsCard";
import { getServiceLandingImage } from "@/lib/seo/landing-images";
import { getAppBaseUrl } from "@/lib/seo/site-url";
import {
  SEO_PROBLEM_PAGES,
  getProblemFaqBySlug,
  getProblemOpeningBySlug,
  getProblemValueBlockBySlug,
  getRelatedPricePages,
  getRelatedProblemPages,
  getSeoProblemBySlug,
  getSeoServiceCityLabels,
} from "@/lib/seo/seo-pages";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return SEO_PROBLEM_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const page = getSeoProblemBySlug(params.slug);
  if (!page) return { title: "Pagina no encontrada" };

  const canonical = `/problemas/${page.slug}`;
  const title = `${page.title}: solicita ayuda hoy | Handi`;

  return {
    title,
    description: page.description,
    alternates: { canonical },
    openGraph: {
      title,
      description: page.description,
      url: canonical,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: page.description,
    },
  };
}

export default function ProblemSeoPage({ params }: { params: Params }) {
  const page = getSeoProblemBySlug(params.slug);
  if (!page) notFound();

  const baseUrl = getAppBaseUrl();
  const canonical = `${baseUrl}/problemas/${page.slug}`;
  const { serviceName, serviceKeyword, cityName } = getSeoServiceCityLabels(
    page.service,
    page.city,
  );
  const editorialContext = { cityName, serviceName, serviceKeyword };
  const openingText = getProblemOpeningBySlug(page.slug, editorialContext);
  const dynamicFaq = getProblemFaqBySlug(page.slug, editorialContext, 4);
  const faqItems = [...page.faq, ...dynamicFaq].slice(0, 4);
  const valueBlock = getProblemValueBlockBySlug(page.slug, editorialContext);
  const relatedPricePages = getRelatedPricePages(
    page.slug,
    page.service,
    page.city,
    1,
  );
  const relatedProblemPages = getRelatedProblemPages(
    page.slug,
    page.service,
    page.city,
    2,
  );

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${baseUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Problemas del hogar",
        item: `${baseUrl}/problemas/${page.slug}`,
      },
    ],
  };

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${serviceName} en ${cityName}`,
    description: page.description,
    areaServed: {
      "@type": "City",
      name: cityName,
    },
    provider: {
      "@type": "Organization",
      name: "Handi",
      url: baseUrl,
    },
    url: canonical,
  };

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
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:space-y-10 md:py-8">
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
          { label: "Problemas del hogar", href: "/servicios" },
          { label: page.title },
        ]}
      />

      <LocalMarketplaceHero
        eyebrow="Problema en casa"
        title={`Tienes ${page.title.toLowerCase()}?`}
        subtitle={page.description}
        quickSignals={[
          "Solicitud guiada",
          "Compatibilidad por necesidad",
          "Acuerdo en plataforma",
        ]}
        imageSrc={getServiceLandingImage(page.service)}
        imageAlt={page.title}
        ctas={
          <div className="space-y-3">
            <LocalLandingCtas
              landingType="service_city"
              serviceSlug={page.service}
              citySlug={page.city}
            />
          </div>
        }
        secondaryNote={`Consulta orientada a ${serviceKeyword} en ${cityName}.`}
      />

      <HowItWorksSection className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-white to-[#eef4ff]" />

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Que puede estar pasando
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          {openingText} {page.problemSummary}
        </p>
        <ul className="grid gap-2 md:grid-cols-3">
          {page.possibleCauses.map((cause) => (
            <li
              key={cause}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
            >
              {cause}
            </li>
          ))}
        </ul>
      </section>

      <TrustSignalChips
        title="Como lo resuelve Handi"
        items={page.handiApproach}
      />

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          {valueBlock.title}
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          {valueBlock.intro}
        </p>
        <ul className="grid gap-2 md:grid-cols-3">
          {valueBlock.items.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-[#f8faff] p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Preguntas frecuentes
        </h2>
        <div className="space-y-2">
          {faqItems.map((item) => (
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

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Tambien te puede servir
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {relatedPricePages.map((item) => (
            <Link
              key={item.slug}
              href={`/precios/${item.slug}`}
              className="text-sm font-medium text-[#082877] hover:underline"
            >
              {item.linkLabel}
            </Link>
          ))}
          {relatedProblemPages.map((item) => (
            <Link
              key={item.slug}
              href={`/problemas/${item.slug}`}
              className="text-sm font-medium text-[#082877] hover:underline"
            >
              {item.linkLabel}
            </Link>
          ))}
          <Link
            href={`/servicios/${page.service}/${page.city}`}
            className="text-sm font-medium text-[#082877] hover:underline"
          >
            Solicitar {serviceKeyword} en {cityName}
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <p className="text-sm text-slate-600">
          Si ya tienes listo el alcance, crea tu solicitud y recibe opciones
          compatibles.
        </p>
        <div className="mt-3">
          <LocalLandingCtas
            landingType="service_city"
            serviceSlug={page.service}
            citySlug={page.city}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 md:p-5">
        Si quieres revisar otros tipos de solicitud para el hogar, visita{" "}
        <Link
          href="/servicios"
          className="font-semibold text-[#082877] hover:underline"
        >
          servicios en Handi
        </Link>
        .
      </section>

      <ProtectedPaymentsCard className="bg-transparent" />
    </main>
  );
}
