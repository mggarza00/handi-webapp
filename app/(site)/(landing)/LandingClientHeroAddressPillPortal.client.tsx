"use client";

import { createPortal } from "react-dom";

import HeroClientActions from "@/components/home/HeroClientActions.client";

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

type LandingClientHeroAddressPillPortalProps = {
  addresses?: SavedAddress[];
  selectedAddress: SavedAddress | null;
  onAddressChange: (addr: SavedAddress | null) => void;
};

export default function LandingClientHeroAddressPillPortal({
  addresses = [],
  selectedAddress,
  onAddressChange,
}: LandingClientHeroAddressPillPortalProps) {
  const target =
    typeof document !== "undefined"
      ? document.getElementById("landing-client-hero-address-pill-slot")
      : null;

  if (!target) return null;

  return createPortal(
    <HeroClientActions
      addresses={addresses}
      selectedAddress={selectedAddress}
      onAddressChange={onAddressChange}
      showButton={false}
    />,
    target,
  );
}
