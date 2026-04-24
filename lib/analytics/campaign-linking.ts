"use client";

import { getAttributionState } from "@/lib/analytics/attribution";
import {
  buildTrackedAuthCtaHref,
  buildTrackedClientSignInHref,
  buildTrackedInternalHref,
  type AnalyticsUrlContext,
} from "@/lib/analytics/cta-builders";

function getCurrentAttributionContext(): AnalyticsUrlContext {
  const state = getAttributionState();
  return {
    ...(state.first_touch || {}),
    ...(state.last_touch || {}),
    ...(state.campaign_context || {}),
  };
}

export function buildTrackedHrefFromCurrentAttribution(
  href: string,
  context: AnalyticsUrlContext = {},
) {
  return buildTrackedInternalHref({
    href,
    context: {
      ...getCurrentAttributionContext(),
      ...context,
    },
  });
}

export function buildTrackedAuthHrefFromCurrentAttribution(args: {
  authPath?: string;
  nextPath: string;
  context?: AnalyticsUrlContext;
  authParams?: Record<string, string | null | undefined>;
}) {
  return buildTrackedAuthCtaHref({
    authPath: args.authPath,
    nextPath: args.nextPath,
    context: {
      ...getCurrentAttributionContext(),
      ...(args.context || {}),
    },
    authParams: args.authParams,
  });
}

export function buildTrackedClientSignInHrefFromCurrentAttribution(args?: {
  authPath?: string;
  role?: "client" | "pro";
  authParams?: Record<string, string | null | undefined>;
  context?: AnalyticsUrlContext;
}) {
  return buildTrackedClientSignInHref({
    authPath: args?.authPath,
    role: args?.role,
    context: {
      ...getCurrentAttributionContext(),
      ...(args?.context || {}),
    },
    authParams: args?.authParams,
  });
}
