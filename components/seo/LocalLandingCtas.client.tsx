"use client";

import Link from "next/link";

import CreateRequestButton from "@/components/requests/CreateRequestButton";
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
    <div className="flex flex-wrap items-center gap-3">
      <CreateRequestButton
        label="Solicitar servicio"
        onClick={() =>
          trackLocalLandingCtaClicked({
            landing_type: landingType,
            service_slug: serviceSlug,
            city_slug: citySlug,
            cta_type: "request_new",
            source_page: sourcePage,
          })
        }
      />
      <Link
        href="/professionals"
        className="text-sm font-semibold text-[#082877] hover:underline"
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
    </div>
  );
}
