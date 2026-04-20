"use client";

import Link from "next/link";
import type { ReactNode } from "react";

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
}: TrackedButtonLinkProps) {
  const handleClick = () => {
    trackAnalyticsEvent(eventName, eventParams);
  };

  const isDownloadLike = href.startsWith("/api/") || target === "_blank";

  if (isDownloadLike) {
    return (
      <Button variant={variant} size={size} className={className} asChild>
        <a
          href={href}
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
      <Link href={href} onClick={handleClick}>
        {children}
      </Link>
    </Button>
  );
}
