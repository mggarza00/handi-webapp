import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumbs from "@/components/breadcrumbs";
import LocalMarketplaceHero from "@/components/seo/LocalMarketplaceHero";
import ProfessionalLandingCta from "@/components/seo/ProfessionalLandingCta.client";
import TrustSignalChips from "@/components/seo/TrustSignalChips";
import ProtectedPaymentsCard from "@/components/shared/ProtectedPaymentsCard";
import { getServiceLandingImage } from "@/lib/seo/landing-images";
import { getAppBaseUrl } from "@/lib/seo/site-url";
import {
  SEO_JOB_PAGES,
  getJobFaqBySlug,
  getJobOpeningBySlug,
  getJobValueBlockBySlug,
  getRelatedJobPages,
  getSeoJobBySlug,
  getSeoServiceCityLabels,
} from "@/lib/seo/seo-pages";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return SEO_JOB_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const page = getSeoJobBySlug(params.slug);
  if (!page) return { title: "Pagina no encontrada" };

  const canonical = `/trabajos/${page.slug}`;
  const title = `${page.title}: como conseguir clientes | Handi`;

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

export default function JobSeoPage({ params }: { params: Params }) {
  const page = getSeoJobBySlug(params.slug);
  if (!page) notFound();

  const baseUrl = getAppBaseUrl();
  const canonical = `${baseUrl}/trabajos/${page.slug}`;
  const { serviceName, cityName } = getSeoServiceCityLabels(
    page.service,
    page.city,
  );
  const editorialContext = {
    cityName,
    serviceName,
    serviceKeyword: serviceName.toLowerCase(),
  };
  const openingText = getJobOpeningBySlug(page.slug, editorialContext);
  const dynamicFaq = getJobFaqBySlug(page.slug, editorialContext, 4);
  const faqItems = [...page.faq, ...dynamicFaq].slice(0, 4);
  const valueBlock = getJobValueBlockBySlug(page.slug, editorialContext);
  const relatedJobs = getRelatedJobPages(page.slug, 2);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${baseUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Trabajos para profesionales",
        item: `${baseUrl}/trabajos/${page.slug}`,
      },
    ],
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: canonical,
    audience: {
      "@type": "Audience",
      audienceType: "Profesionales de servicios para hogar",
    },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          {
            label: "Trabajos para profesionales",
            href: "/landing/profesionales",
          },
          { label: page.title },
        ]}
      />

      <LocalMarketplaceHero
        eyebrow="Para profesionales"
        title={page.title}
        subtitle={`${openingText} Activa tu perfil en Handi para recibir solicitudes compatibles y cerrar acuerdos con clientes reales.`}
        quickSignals={[
          "Solicitudes compatibles",
          "Conversacion directa por chat",
          "Acuerdos dentro de Handi",
        ]}
        imageSrc={getServiceLandingImage(page.service)}
        imageAlt={page.title}
        ctas={<ProfessionalLandingCta />}
      />

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Como funciona para profesionales
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">{openingText}</p>
        <ul className="grid gap-2 md:grid-cols-3">
          {page.howItWorks.map((step) => (
            <li
              key={step}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
            >
              {step}
            </li>
          ))}
        </ul>
      </section>

      <TrustSignalChips
        title="Acciones para mejorar resultados"
        items={page.profileTips}
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
          Preguntas frecuentes para profesionales
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
          Otras rutas para profesionales
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {relatedJobs.map((item) => (
            <Link
              key={item.slug}
              href={`/trabajos/${item.slug}`}
              className="text-sm font-medium text-[#082877] hover:underline"
            >
              {item.linkLabel}
            </Link>
          ))}
          <Link
            href="/landing/profesionales"
            className="text-sm font-medium text-[#082877] hover:underline"
          >
            Registro para profesionales en Handi
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <p className="text-sm text-slate-600">
          Si ya tienes perfil activo, revisa nuevas oportunidades hoy mismo.
        </p>
        <div className="mt-3">
          <ProfessionalLandingCta />
        </div>
      </section>

      <ProtectedPaymentsCard className="bg-transparent" />
    </main>
  );
}
