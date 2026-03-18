"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { trackPrimaryCtaClicked } from "@/lib/analytics/track";

export default function ProApplyLandingCta() {
  return (
    <Button
      asChild
      size="lg"
      className="h-12 w-full min-w-[240px] rounded-full bg-[#0f5a3f] px-7 text-sm font-semibold text-white shadow-lg shadow-[#0f5a3f]/25 hover:bg-[#0b452f] sm:w-auto"
    >
      <Link
        href="/auth/sign-in?next=%2Fpro-apply&toast=pro-apply"
        onClick={() =>
          trackPrimaryCtaClicked({
            page_type: "pro_apply_landing",
            placement: "hero_image",
            user_type: "unknown",
            cta_label: "Postularme como profesional",
            cta_target: "/auth/sign-in?next=/pro-apply",
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
