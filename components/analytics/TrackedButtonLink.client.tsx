"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

import { buildTrackedHrefFromCurrentAttribution } from "@/lib/analytics/campaign-linking";
import type { AnalyticsUrlContext } from "@/lib/analytics/cta-builders";
import type { AnalyticsEventName } from "@/lib/analytics/schemas";
import {
  trackAnalyticsEvent,
  type AnalyticsEventParams,
} from "@/lib/analytics/tracking";
import { Button } from "@/components/ui/button";

type TrackedButtonLinkProps = {
  href: string;
  children: ReactNode;
  eventName: AnalyticsEventName;
  eventParams?: AnalyticsEventParams;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  target?: string;
  className?: string;
  analyticsContext?: AnalyticsUrlContext;
  preserveAnalyticsContext?: boolean;
};

export default function TrackedButtonLink({
  href,
  children,
  eventName,
  eventParams = {},
  variant = "default",
  size = "default",
  target,
  className,
  analyticsContext,
  preserveAnalyticsContext = false,
}: TrackedButtonLinkProps) {
  const resolvedHref = useMemo(() => {
    if (!preserveAnalyticsContext && !analyticsContext) return href;
    return buildTrackedHrefFromCurrentAttribution(href, analyticsContext || {});
  }, [analyticsContext, href, preserveAnalyticsContext]);

  const handleClick = () => {
    trackAnalyticsEvent(eventName, eventParams);
  };

  const isDownloadLike =
    resolvedHref.startsWith("/api/") || target === "_blank";

  if (isDownloadLike) {
    return (
      <Button variant={variant} size={size} className={className} asChild>
        <a
          href={resolvedHref}
          target={target}
          rel={target === "_blank" ? "noreferrer" : undefined}
          onClick={handleClick}
        >
          {children}
        </a>
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} className={className} asChild>
      <Link href={resolvedHref} onClick={handleClick}>
        {children}
      </Link>
    </Button>
  );
}
