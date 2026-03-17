"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  trackPrimaryCtaClicked,
  trackSecondaryCtaClicked,
} from "@/lib/analytics/track";

type CampaignTrackingContext = {
  pageType: string;
  placement?: string;
  userType?: "client" | "pro" | "admin" | "unknown";
  serviceSlug?: string;
  citySlug?: string;
  profileId?: string;
};

type CtaConfig = {
  label: string;
  href: string;
};

type Props = {
  primary: CtaConfig;
  secondary?: CtaConfig;
  trackingContext: CampaignTrackingContext;
  className?: string;
};

function getSourcePage(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.pathname;
}

export default function CampaignCtaGroup({
  primary,
  secondary,
  trackingContext,
  className,
}: Props) {
  const baseEvent = {
    page_type: trackingContext.pageType,
    placement: trackingContext.placement,
    user_type: trackingContext.userType,
    service_slug: trackingContext.serviceSlug,
    city_slug: trackingContext.citySlug,
    profile_id: trackingContext.profileId,
  };

  return (
    <div className={className ?? "flex flex-wrap gap-3"}>
      <Button asChild>
        <Link
          href={primary.href}
          onClick={() =>
            trackPrimaryCtaClicked({
              ...baseEvent,
              cta_target: primary.href,
              cta_label: primary.label,
              source_page: getSourcePage(),
            })
          }
        >
          {primary.label}
        </Link>
      </Button>
      {secondary ? (
        <Button variant="outline" asChild>
          <Link
            href={secondary.href}
            onClick={() =>
              trackSecondaryCtaClicked({
                ...baseEvent,
                cta_target: secondary.href,
                cta_label: secondary.label,
                source_page: getSourcePage(),
              })
            }
          >
            {secondary.label}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
