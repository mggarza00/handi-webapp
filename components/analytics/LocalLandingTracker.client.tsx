"use client";

import { useEffect } from "react";

import { trackLocalLandingViewed } from "@/lib/analytics/track";

type Props = {
  landingType: "service" | "city" | "service_city";
  serviceSlug?: string;
  citySlug?: string;
};

export default function LocalLandingTracker({
  landingType,
  serviceSlug,
  citySlug,
}: Props) {
  useEffect(() => {
    trackLocalLandingViewed({
      landing_type: landingType,
      service_slug: serviceSlug,
      city_slug: citySlug,
      source_page:
        typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }, [citySlug, landingType, serviceSlug]);

  return null;
}
