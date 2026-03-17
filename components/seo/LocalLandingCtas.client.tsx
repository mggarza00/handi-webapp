"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { trackLocalLandingCtaClicked } from "@/lib/analytics/track";

type Props = {
  landingType: "service" | "city" | "service_city";
  serviceSlug?: string;
  citySlug?: string;
};

export default function LocalLandingCtas({
  landingType,
  serviceSlug,
  citySlug,
}: Props) {
  const sourcePage =
    typeof window !== "undefined" ? window.location.pathname : undefined;

  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild>
        <Link
          href="/requests/new"
          onClick={() =>
            trackLocalLandingCtaClicked({
              landing_type: landingType,
              service_slug: serviceSlug,
              city_slug: citySlug,
              cta_type: "request_new",
              source_page: sourcePage,
            })
          }
        >
          Solicitar servicio
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link
          href="/professionals"
          onClick={() =>
            trackLocalLandingCtaClicked({
              landing_type: landingType,
              service_slug: serviceSlug,
              city_slug: citySlug,
              cta_type: "professionals_list",
              source_page: sourcePage,
            })
          }
        >
          Ver profesionales
        </Link>
      </Button>
    </div>
  );
}
