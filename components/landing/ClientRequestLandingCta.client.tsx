"use client";

import CreateRequestButton from "@/components/requests/CreateRequestButton";
import { trackPrimaryCtaClicked } from "@/lib/analytics/track";

export default function ClientRequestLandingCta() {
  return (
    <CreateRequestButton
      label="Solicitar servicio"
      size="lg"
      className="h-12 w-full min-w-[220px] rounded-full bg-[#082877] px-7 text-sm font-semibold text-white shadow-lg shadow-[#082877]/25 hover:bg-[#061d58] sm:w-auto"
      onClick={() =>
        trackPrimaryCtaClicked({
          page_type: "campaign_client_landing",
          placement: "hero_image",
          user_type: "unknown",
          cta_label: "Solicitar servicio",
          cta_target: "create_request_wizard",
          source_page:
            typeof window !== "undefined"
              ? window.location.pathname
              : undefined,
        })
      }
    />
  );
}
