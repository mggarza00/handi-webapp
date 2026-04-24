"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { buildTrackedAuthHrefFromCurrentAttribution } from "@/lib/analytics/campaign-linking";
import { trackPrimaryCtaClicked } from "@/lib/analytics/track";

export default function ProApplyLandingCta() {
  const [href, setHref] = useState(
    "/auth/sign-in?next=%2Fpro-apply&toast=pro-apply",
  );

  useEffect(() => {
    setHref(
      buildTrackedAuthHrefFromCurrentAttribution({
        nextPath: "/pro-apply",
        authParams: { toast: "pro-apply" },
      }),
    );
  }, []);

  return (
    <Button
      asChild
      size="lg"
      className="h-12 w-full min-w-[240px] rounded-full bg-[#0f5a3f] px-7 text-sm font-semibold text-white shadow-lg shadow-[#0f5a3f]/25 hover:bg-[#0b452f] sm:w-auto"
    >
      <Link
        href={href}
        onClick={() =>
          trackPrimaryCtaClicked({
            page_type: "pro_apply_landing",
            placement: "hero_image",
            user_type: "unknown",
            cta_label: "Postularme como profesional",
            cta_target: href,
            source_page:
              typeof window !== "undefined"
                ? window.location.pathname
                : undefined,
          })
        }
      >
        Postularme como profesional
      </Link>
    </Button>
  );
}
