"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import HeroClientActions from "@/components/home/HeroClientActions.client";
import { openCreateRequestWizard } from "@/components/requests/CreateRequestWizardRoot";
import { trackHeroCtaClicked } from "@/lib/analytics/track";

const LandingClientHeroAddressPillPortal = dynamic(
  () => import("./LandingClientHeroAddressPillPortal.client"),
  { ssr: false },
);

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
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(
    addresses[0] ?? null,
  );

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

  useEffect(() => {
    if (addresses.length === 0) {
      setSelectedAddress(null);
      return;
    }
    setSelectedAddress((current) => current ?? addresses[0] ?? null);
  }, [addresses]);

  const handleAddressChange = (addr: SavedAddress | null) => {
    setSelectedAddress(addr);
  };

  return (
    <>
      <HeroClientActions
        ctaLabel="Solicitar un servicio"
        addresses={addresses}
        selectedAddress={selectedAddress}
        onAddressChange={handleAddressChange}
        triggerClassName={triggerClassName}
        showPill={false}
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
      <LandingClientHeroAddressPillPortal
        addresses={addresses}
        selectedAddress={selectedAddress}
        onAddressChange={handleAddressChange}
      />
    </>
  );
}
