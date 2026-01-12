/* eslint-disable react/no-unescaped-entities */
"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import {
  interLight,
  stackSansExtraLight,
  stackSansLight,
  stackSansMedium,
} from "./landing-fonts";

import HeroClientActions from "@/components/home/HeroClientActions.client";
import HiddenIfClientHasSession from "@/components/HiddenIfClientHasSession.client";
import PaymentProtectionBadge from "@/components/PaymentProtectionBadge";
import RoleSelectionDialog from "@/components/RoleSelectionDialog.client";
import { openCreateRequestWizard } from "@/components/requests/CreateRequestWizardRoot";

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
  fullName: incomingName,
  savedAddresses = [],
}: LandingHeroProps) {
  const isClientVariant = variant === "client";
  const displayName = (incomingName || "").toString().trim() || "Cliente";
  const resolvedGreeting =
    (greetingText || "").trim() || `Bienvenido(a) ${displayName}`;
  const [greetingFirstWord, ...greetingRestParts] =
    resolvedGreeting.split(/\s+/);
  const greetingRest = greetingRestParts.join(" ") || displayName;

  type SavedAddress = NonNullable<LandingHeroProps["savedAddresses"]>[number];
  const initialSaved = Array.isArray(savedAddresses) ? savedAddresses : [];
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(
    initialSaved[0] ?? null,
  );
  const heroTitleRef = useRef<HTMLDivElement | null>(null);
  const heroClientTitleRef = useRef<HTMLParagraphElement | null>(null);
  const heroSubtitleRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const addresses = savedAddresses ?? [];
    if (addresses.length === 0) {
      setSelectedAddress(null);
      return;
    }
    setSelectedAddress((current) => current ?? addresses[0] ?? null);
  }, [savedAddresses]);

  useEffect(() => {
    if (!isClientVariant) return;
    if (typeof window === "undefined") return;
    const STORAGE_KEY = "handi:auto-open-request-wizard";
    const shouldAutoOpen =
      window.sessionStorage.getItem(STORAGE_KEY) === "pending";
    if (!shouldAutoOpen) return;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const timer = window.setTimeout(() => {
      openCreateRequestWizard();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isClientVariant]);

  // Efecto de aparición por caracteres en el título del hero (similar a "Bienvenido a Handi")
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia?.("(min-width: 768px)").matches) return;
    const MAX_HERO_SPLIT_CHARS = 160;
    const countChars = (node: HTMLElement | null) =>
      (node?.textContent || "").length;
    const totalChars =
      countChars(heroTitleRef.current) + countChars(heroClientTitleRef.current);
    if (totalChars > MAX_HERO_SPLIT_CHARS) return;

    const run = async () => {
      const applySplit = (root: HTMLElement | null): HTMLElement[] => {
        if (!root) return [];
        const anyRoot = root as HTMLElement & {
          dataset?: Record<string, string>;
        };
        if (anyRoot.dataset?.heroSplitApplied) {
          return Array.from(root.querySelectorAll<HTMLElement>(".hero-split"));
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) =>
            node.textContent && node.textContent.trim().length > 0
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT,
        });

        const textNodes: Text[] = [];
        while (walker.nextNode()) {
          textNodes.push(walker.currentNode as Text);
        }

        textNodes.forEach((tn) => {
          const frag = document.createDocumentFragment();
          const chars = tn.textContent || "";
          for (const ch of Array.from(chars)) {
            const span = document.createElement("span");
            span.textContent = ch === " " ? "\u00A0" : ch;
            span.className =
              "hero-split inline-block align-baseline opacity-0 translate-y-6";
            frag.appendChild(span);
          }
          tn.parentNode?.replaceChild(frag, tn);
        });

        if (anyRoot.dataset) {
          anyRoot.dataset.heroSplitApplied = "1";
        }

        return Array.from(root.querySelectorAll<HTMLElement>(".hero-split"));
      };

      const titleChars = applySplit(heroTitleRef.current);
      const clientChars = applySplit(heroClientTitleRef.current);

      const allChars = [...titleChars, ...clientChars];
      if (!allChars.length) return;

      const { gsap } = await import("gsap");

      const subtitle = heroSubtitleRef.current;
      if (subtitle) {
        gsap.set(subtitle, { opacity: 0 });
      }
      const tl = gsap.timeline();
      tl.to(allChars, {
        opacity: 1,
        y: 0,
        ease: "power3.out",
        duration: 0.6,
        stagger: 0.05,
      });
      if (subtitle && titleChars.length) {
        tl.to(
          subtitle,
          {
            opacity: 1,
            ease: "power2.out",
            duration: 0.8,
          },
          "+=0.05",
        );
      }
    };

    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const schedule = () => {
      void run();
    };

    if (win.requestIdleCallback) {
      idleHandle = win.requestIdleCallback(schedule, { timeout: 2000 });
    } else {
      timeoutHandle = window.setTimeout(schedule, 1000);
    }

    return () => {
      if (idleHandle !== null && win.cancelIdleCallback) {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, []);

  const heroGuest = (
    <section id="hero" className="relative isolate overflow-hidden bg-slate-50">
      <div className="relative w-full">
        <div
          className="guest-hero__visual relative w-full md:aspect-[21/9] lg:h-[620px]"
          style={{ minHeight: "calc(100vh - var(--hero-header-height))" }}
        >
          <Image
            src="/images/be204f42cd07529e6b8dc2c7c9218d6f5728f12b.jpg"
            alt="Profesional industrial trabajando con equipo de seguridad"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div
            className={`${stackSansMedium.className} absolute left-6 top-36 w-[240px] text-white font-semibold leading-[1.04] text-[26px] drop-shadow-[0_14px_32px_rgba(0,0,0,0.55)] md:left-[96px] md:top-[180px] md:w-[300px] md:text-[38px]`}
            ref={heroTitleRef}
          >
            <span className="block">No es magia,</span>
            <span className="block">es Handi</span>
          </div>
          <p
            className={`${interLight.className} absolute left-6 top-[220px] w-[260px] text-white text-sm leading-snug text-left opacity-0 drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)] md:left-[96px] md:top-[270px] md:w-[380px] md:text-base`}
            ref={heroSubtitleRef}
          >
            <span className="block font-semibold">
              Conecta con profesionales
            </span>
            <span className="block">
              de <em className="italic">confianza</em> para cualquier
            </span>
            <span className="block">servicio en tu hogar</span>
          </p>
          <HiddenIfClientHasSession>
            <div className="absolute left-6 top-[370px] z-10 md:left-[96px] md:top-[420px]">
              <RoleSelectionDialog
                triggerLabel="Comenzar"
                triggerClassName={`btn-contratar ${stackSansMedium.className}`}
                triggerShowCircle
              />
            </div>
          </HiddenIfClientHasSession>

          {/* Badge de pagos protegidos sobre el hero (solo desktop) */}
          <div className="hero-payment-badge absolute inset-0 pointer-events-none hidden md:block">
            <PaymentProtectionBadge />
          </div>
        </div>
      </div>
    </section>
  );

  const heroClient = (
    <div
      style={{ marginTop: heroMarginTop }}
      className="px-4 pb-8 sm:px-[2.625rem]"
    >
      <div className="mx-auto max-w-6xl rounded-3xl bg-white shadow-sm overflow-hidden px-0">
        <section
          id="hero-client"
          className="client-hero relative isolate overflow-hidden bg-slate-900 text-white"
        >
          <div className="relative w-full">
            <div className="client-hero__visual relative w-full min-h-[400px] sm:aspect-[16/9] sm:min-h-[480px] md:aspect-[21/9] md:min-h-[520px] lg:min-h-[560px] xl:min-h-[600px] max-h-[880px]">
              <Image
                src="/images/ac305e5695416fe62abbe78d5ed7297e99cebbfa (1).jpg"
                alt="Cliente Handi en casa"
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/45 to-black/20" />
              <div className="absolute inset-0 flex h-full flex-col justify-center px-6 py-8 md:block md:px-0 md:py-0">
                <div className="md:absolute md:left-[96px] md:top-[60px] lg:top-[70px] absolute left-6 top-6 sm:static sm:left-auto sm:top-auto">
                  <h1
                    className={`${stackSansMedium.className} text-2xl leading-tight sm:text-4xl`}
                  >
                    <span
                      className={`${stackSansExtraLight.className} leading-tight text-[22px] sm:text-[32px] tracking-[-0.02em] font-light text-white`}
                      style={{ fontFamily: '"Stack Sans Text", sans-serif' }}
                    >
                      {greetingFirstWord}
                    </span>
                    <span
                      className={`${interLight.className} text-[22px] sm:text-[32px] leading-tight tracking-[-0.02em] font-light`}
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
                <div className="md:absolute md:left-[96px] md:top-[210px] lg:top-[230px] mb-8 md:mb-0">
                  <div className="flex flex-col gap-4">
                    <p
                      ref={heroClientTitleRef}
                      style={{
                        fontFamily:
                          '"Stack Sans Text", system-ui, -apple-system, "Segoe UI", sans-serif',
                        fontWeight: 400,
                        fontStyle: "normal",
                        letterSpacing: "0%",
                      }}
                      className={`${stackSansMedium.className} max-w-2xl text-white text-[38px] sm:text-[50px] leading-[1.06]`}
                    >
                      <span
                        className={`${stackSansLight.className} block leading-[1.06] font-thin`}
                      >
                        Profesionales
                      </span>
                      <span className="block leading-[1.06]">a tu alcance</span>
                    </p>
                    <div className="mt-[70px] md:mt-12">
                      <HeroClientActions
                        ctaLabel="Solicitar un servicio"
                        addresses={savedAddresses}
                        selectedAddress={selectedAddress}
                        onAddressChange={(addr) =>
                          setSelectedAddress(
                            addr
                              ? {
                                  ...addr,
                                  label: addr.label ?? null,
                                  address_place_id:
                                    addr.address_place_id ?? null,
                                  lat: addr.lat ?? null,
                                  lng: addr.lng ?? null,
                                }
                              : null,
                          )
                        }
                        triggerClassName={`btn-contratar ${stackSansMedium.className}`}
                        showPill={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <HeroClientActions
                ctaLabel="Solicitar un servicio"
                addresses={savedAddresses}
                selectedAddress={selectedAddress}
                onAddressChange={(addr) =>
                  setSelectedAddress(
                    addr
                      ? {
                          ...addr,
                          label: addr.label ?? null,
                          address_place_id: addr.address_place_id ?? null,
                          lat: addr.lat ?? null,
                          lng: addr.lng ?? null,
                        }
                      : null,
                  )
                }
                showButton={false}
                addressPillClassName="absolute bottom-6 right-6 z-20 -mt-20 md:mt-0 md:bottom-8 md:right-10"
              />
              <div className="hero-payment-badge absolute inset-0 pointer-events-none hidden md:block">
                <PaymentProtectionBadge />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  return isClientVariant ? heroClient : heroGuest;
}
