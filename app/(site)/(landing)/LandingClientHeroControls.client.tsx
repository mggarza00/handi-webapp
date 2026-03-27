"use client";

import { useEffect } from "react";

import HeroClientActions from "@/components/home/HeroClientActions.client";
import { openCreateRequestWizard } from "@/components/requests/CreateRequestWizardRoot";
import { trackHeroCtaClicked } from "@/lib/analytics/track";

type SavedAddress = {
  id?: string;
  label: string | null;
  address_line: string;
  address_place_id: string | null;
  lat: number | null;
  lng: number | null;
  last_used_at?: string | null;
  times_used?: number | null;
};

type LandingClientHeroControlsProps = {
  addresses?: SavedAddress[];
  triggerClassName: string;
};

export default function LandingClientHeroControls({
  addresses = [],
  triggerClassName,
}: LandingClientHeroControlsProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = "handi:auto-open-request-wizard";
    const shouldAutoOpen =
      window.sessionStorage.getItem(storageKey) === "pending";
    if (!shouldAutoOpen) return;

    window.sessionStorage.removeItem(storageKey);
    const timer = window.setTimeout(() => {
      openCreateRequestWizard();
    }, 400);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <HeroClientActions
      ctaLabel="Solicitar un servicio"
      addresses={addresses}
      triggerClassName={triggerClassName}
      addressPillClassName="absolute bottom-6 right-6 z-20 md:bottom-8 md:right-10"
      onPrimaryCtaClick={() =>
        trackHeroCtaClicked({
          page_type: "home",
          placement: "hero",
          source_page:
            typeof window !== "undefined"
              ? window.location.pathname
              : undefined,
          cta_label: "Solicitar un servicio",
          cta_target: "/requests/new",
          user_type: "client",
        })
      }
    />
  );
}
