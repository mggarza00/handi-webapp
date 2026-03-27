/* eslint-disable react/no-unescaped-entities */
import Image from "next/image";

import LandingClientHeroControls from "./LandingClientHeroControls.client";
import LandingGuestHeroCta from "./LandingGuestHeroCta.client";
import {
  interLight,
  stackSansExtraLight,
  stackSansLight,
  stackSansMedium,
} from "./landing-fonts";

import PaymentProtectionBadge from "@/components/PaymentProtectionBadge";

type LandingHeroProps = {
  variant: "guest" | "client" | "other";
  greetingText?: string;
  fullName?: string | null;
  savedAddresses?: Array<{
    id?: string;
    label: string | null;
    address_line: string;
    address_place_id: string | null;
    lat: number | null;
    lng: number | null;
    last_used_at?: string | null;
    times_used?: number | null;
  }>;
};

const heroMarginTop = "4.25rem";

export default function LandingHero({
  variant,
  greetingText,
  fullName,
  savedAddresses = [],
}: LandingHeroProps) {
  const isClientVariant = variant === "client";
  const displayName = (fullName || "").toString().trim() || "Cliente";
  const resolvedGreeting =
    (greetingText || "").trim() || `Bienvenido(a) ${displayName}`;
  const [greetingFirstWord, ...greetingRestParts] =
    resolvedGreeting.split(/\s+/);
  const greetingRest = greetingRestParts.join(" ") || displayName;

  if (!isClientVariant) {
    return (
      <section
        id="hero"
        className="relative isolate overflow-hidden bg-slate-950"
      >
        <div
          id="hero-sentinel"
          className="absolute inset-x-0 top-0 h-px w-px"
          aria-hidden="true"
        />
        <div className="relative w-full">
          <div className="guest-hero__visual relative w-full min-h-[560px] sm:min-h-[640px] md:aspect-[21/9] md:min-h-[560px] lg:h-[620px]">
            <Image
              src="/images/hero-guest-home.webp"
              alt="Profesional industrial trabajando con equipo de seguridad"
              fill
              className="object-cover object-center"
              sizes="100vw"
              priority
              fetchPriority="high"
              quality={68}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/78 via-black/42 to-black/18 md:bg-gradient-to-r md:from-black/72 md:via-black/28 md:to-transparent" />
            <div className="absolute inset-0 px-6 pb-8 pt-32 md:px-24 md:pb-12 md:pt-44">
              <div className="max-w-[280px] md:max-w-[380px]">
                <h1
                  className={`${stackSansMedium.className} text-[28px] font-semibold leading-[1.02] tracking-[-0.03em] text-white drop-shadow-[0_10px_26px_rgba(0,0,0,0.55)] md:text-[42px]`}
                >
                  <span className="block">No es magia,</span>
                  <span className="block">es Handi</span>
                </h1>
                <p
                  className={`${interLight.className} mt-5 max-w-[270px] text-[15px] leading-6 text-white/96 drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)] md:mt-6 md:max-w-[390px] md:text-base`}
                >
                  <span className="block font-semibold">
                    Conecta con profesionales
                  </span>
                  <span className="block">
                    de <em className="italic">confianza</em> para cualquier
                  </span>
                  <span className="block">servicio en tu hogar</span>
                </p>
              </div>
              <div className="mt-8 md:mt-12">
                <LandingGuestHeroCta
                  triggerClassName={`btn-contratar min-h-11 min-w-36 ${stackSansMedium.className}`}
                />
              </div>
            </div>

            <div className="hero-payment-badge pointer-events-none absolute inset-0 hidden md:block">
              <PaymentProtectionBadge />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      style={{ marginTop: heroMarginTop }}
      className="px-4 pb-8 sm:px-[2.625rem]"
    >
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-white px-0 shadow-sm">
        <section
          id="hero-client"
          className="client-hero relative isolate overflow-hidden bg-slate-950 text-white"
        >
          <div
            id="hero-sentinel"
            className="absolute inset-x-0 top-0 h-px w-px"
            aria-hidden="true"
          />
          <div className="relative w-full">
            <div className="client-hero__visual relative w-full min-h-[520px] max-h-[880px] sm:aspect-[16/9] sm:min-h-[560px] md:aspect-[21/9] md:min-h-[520px] lg:min-h-[560px] xl:min-h-[600px]">
              <Image
                src="/images/hero-client-home.webp"
                alt="Cliente Handi en casa"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1152px"
                priority
                fetchPriority="high"
                quality={72}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-black/46 to-black/18 md:bg-gradient-to-br md:from-black/72 md:via-black/48 md:to-black/20" />
              <div className="absolute inset-0 flex h-full flex-col justify-center px-6 py-8 md:block md:px-0 md:py-0">
                <div className="absolute left-6 top-6 md:left-[96px] md:top-[60px] lg:top-[70px]">
                  <h1
                    className={`${stackSansMedium.className} text-2xl leading-tight text-white sm:text-4xl`}
                  >
                    <span
                      className={`${stackSansExtraLight.className} text-[22px] font-light leading-tight tracking-[-0.02em] text-white sm:text-[32px]`}
                      style={{ fontFamily: '"Stack Sans Text", sans-serif' }}
                    >
                      {greetingFirstWord}
                    </span>
                    <span
                      className={`${interLight.className} text-[22px] font-light leading-tight tracking-[-0.02em] text-white sm:text-[32px]`}
                    >
                      ,
                    </span>{" "}
                    <span
                      className={`${stackSansLight.className} font-light text-white`}
                      style={{ fontFamily: '"Stack Sans Text", sans-serif' }}
                    >
                      {greetingRest}
                    </span>
                  </h1>
                </div>
                <div className="mb-8 md:absolute md:left-[96px] md:top-[210px] md:mb-0 lg:top-[230px]">
                  <div className="flex flex-col gap-4">
                    <p
                      style={{
                        fontFamily:
                          '"Stack Sans Text", system-ui, -apple-system, "Segoe UI", sans-serif',
                        fontWeight: 400,
                        fontStyle: "normal",
                      }}
                      className={`${stackSansMedium.className} max-w-2xl text-[38px] leading-[1.06] text-white sm:text-[50px]`}
                    >
                      <span
                        className={`${stackSansLight.className} block font-thin leading-[1.06]`}
                      >
                        Profesionales
                      </span>
                      <span className="block leading-[1.06]">a tu alcance</span>
                    </p>
                    <div className="mt-[70px] md:mt-12">
                      <LandingClientHeroControls
                        addresses={savedAddresses}
                        triggerClassName={`btn-contratar ${stackSansMedium.className}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="hero-payment-badge pointer-events-none absolute inset-0 hidden md:block">
                <PaymentProtectionBadge />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
