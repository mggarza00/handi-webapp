import type React from "react";
import Image from "next/image";

import {
  interLight,
  stackSansLight,
  stackSansMedium,
} from "@/app/(site)/(landing)/landing-fonts";
import DeferOnIdle from "@/components/DeferOnIdle.client";
import MobileCarousel from "@/components/MobileCarousel";

type HowItWorksSectionProps = {
  className?: string;
  id?: string;
};

export default function HowItWorksSection({
  className = "border-b border-slate-200 bg-gradient-to-b from-white via-white to-[#e8e8e8]",
  id = "como-funciona",
}: HowItWorksSectionProps) {
  return (
    <section className={className} id={id}>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8 space-y-2 text-center">
          <h2
            className={`${stackSansMedium.className} text-[40px] leading-[1] font-semibold tracking-[0] text-[#082877]`}
          >
            Como funciona
          </h2>
          <p
            className={`${interLight.className} text-sm md:text-base text-[#082877]`}
          >
            Describe lo que necesitas, compara perfiles y contrata con
            proteccion de pagos.
          </p>
        </div>

        <div className="md:hidden -mx-4 overflow-x-hidden">
          <DeferOnIdle
            fallback={<div className="h-[340px]" aria-hidden="true" />}
          >
            <MobileCarousel
              className="px-0 pt-6"
              gap={16}
              padding={16}
              autoplay
              autoplayDelay={4000}
              loop
              pauseOnHover
              threeD={false}
            >
              <StepCard
                step="1"
                title="Crea tu solicitud de servicio"
                desc="Describe el servicio que necesitas, presupuesto, lugar y fecha."
                rightImageSrc="/images/nueva-solicitud-mockup-short.png"
              />
              <StepCard
                step="2"
                title="Compara profesionales"
                desc="Revisa perfiles de profesionales disponibles dentro de tu solicitud."
                rightImageSrc="/images/profesionals-list-mockup-short.png"
              />
              <StepCard
                step="3"
                title="Contrata con confianza"
                desc="Chatea con los profesionales dentro de la app, pide cotizaciones y contrata a traves del chat."
                rightImageSrc="/images/chat-mockup-short.png"
              />
            </MobileCarousel>
          </DeferOnIdle>
        </div>

        <div className="hidden md:grid grid-cols-1 gap-6 md:grid-cols-3">
          <StepCard
            step="1"
            title="Crea tu solicitud de servicio"
            desc="Describe el servicio que necesitas, presupuesto, lugar y fecha."
            rightImageSrc="/images/nueva-solicitud-mockup-short.png"
          />
          <StepCard
            step="2"
            title="Compara profesionales"
            desc="Revisa perfiles de profesionales disponibles dentro de tu solicitud."
            rightImageSrc="/images/profesionals-list-mockup-short.png"
          />
          <StepCard
            step="3"
            title="Contrata con confianza"
            desc="Chatea con los profesionales dentro de la app, pide cotizaciones y contrata a traves del chat."
            rightImageSrc="/images/chat-mockup-short.png"
          />
        </div>
      </div>
    </section>
  );
}

function StepCard({
  step,
  title,
  desc,
  rightImageSrc,
}: {
  step: string;
  title: string;
  desc: string;
  rightImageSrc?: string;
}) {
  const withImage = Boolean(rightImageSrc);

  return (
    <div className="relative isolate overflow-visible rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="absolute -top-3 left-6 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
        Paso {step}
      </div>

      {!withImage ? (
        <div className="flex flex-col gap-2">
          <h3
            className={`${stackSansMedium.className} mb-2.5 text-lg leading-snug text-[#001447] line-clamp-2 text-balance`}
          >
            {title}
          </h3>
          <p
            className={`${stackSansLight.className} text-xs leading-snug text-slate-600 line-clamp-6`}
          >
            {desc}
          </p>
        </div>
      ) : (
        <div className="relative min-h-[196px] md:grid md:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)] md:items-stretch">
          <div className="min-w-0 pr-40 md:pr-0">
            <h3
              className={`${stackSansMedium.className} mb-2.5 text-lg leading-snug text-[#001447] line-clamp-2 text-balance`}
            >
              {title}
            </h3>
            <p
              className={`${stackSansLight.className} text-xs leading-snug text-slate-600 line-clamp-6`}
            >
              {desc}
            </p>
          </div>

          <div className="absolute -right-4 bottom-[-1.5rem] md:hidden">
            <div
              className="relative h-56"
              style={{ width: "min(12rem, 44vw)" }}
            >
              <Image
                src={rightImageSrc as string}
                alt={title}
                fill
                className="object-contain object-bottom"
                sizes="(max-width: 768px) 12rem, 12rem"
                priority
              />
            </div>
          </div>

          <div className="hidden md:flex items-end justify-end">
            <div
              className="relative max-w-[15rem] mb-[-1.5rem]"
              style={{
                width: "min(15rem, 100%)",
                height: "calc(100% + 16px)",
              }}
            >
              <div className="relative h-full w-full">
                <Image
                  src={rightImageSrc as string}
                  alt={title}
                  fill
                  className="object-contain object-bottom"
                  sizes="(max-width: 1280px) 15rem, 18rem"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
