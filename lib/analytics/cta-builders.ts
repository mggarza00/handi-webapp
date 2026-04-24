import {
  appendAnalyticsContextToUrl,
  buildTrackedAuthHref,
  readAnalyticsContextFromCookieHeader,
  type AnalyticsUrlContext,
} from "@/lib/analytics/url-context";

export type CampaignCtaContext = AnalyticsUrlContext;

export function buildTrackedInternalHref(args: {
  href: string;
  context?: CampaignCtaContext;
  baseOrigin?: string;
}) {
  return appendAnalyticsContextToUrl(
    args.href,
    args.context || {},
    args.baseOrigin,
  );
}

export function buildTrackedAuthCtaHref(args: {
  authPath?: string;
  nextPath?: string;
  context?: CampaignCtaContext;
  authParams?: Record<string, string | null | undefined>;
  baseOrigin?: string;
}) {
  if (args.nextPath) {
    return buildTrackedAuthHref({
      authPath: args.authPath,
      nextPath: args.nextPath,
      context: args.context,
      authParams: args.authParams,
      baseOrigin: args.baseOrigin,
    });
  }

  return appendAnalyticsContextToUrl(
    args.authPath || "/auth/sign-in",
    {
      ...(args.context || {}),
      ...(args.authParams || {}),
    },
    args.baseOrigin,
  );
}

export function buildTrackedProApplyAuthHref(args?: {
  context?: CampaignCtaContext;
  authPath?: string;
  authParams?: Record<string, string | null | undefined>;
  baseOrigin?: string;
}) {
  return buildTrackedAuthCtaHref({
    authPath: args?.authPath || "/auth/sign-in",
    nextPath: "/pro-apply",
    context: args?.context,
    authParams: args?.authParams,
    baseOrigin: args?.baseOrigin,
  });
}

export function buildTrackedClientSignInHref(args?: {
  context?: CampaignCtaContext;
  authPath?: string;
  role?: "client" | "pro";
  authParams?: Record<string, string | null | undefined>;
  baseOrigin?: string;
}) {
  return buildTrackedAuthCtaHref({
    authPath: args?.authPath || "/auth/sign-in",
    context: args?.context,
    authParams: {
      role: args?.role || "client",
      ...(args?.authParams || {}),
    },
    baseOrigin: args?.baseOrigin,
  });
}

export function buildTrackedHrefFromCookieHeader(args: {
  href: string;
  cookieHeader: string | null;
  context?: CampaignCtaContext;
  baseOrigin?: string;
}) {
  return buildTrackedInternalHref({
    href: args.href,
    context: {
      ...readAnalyticsContextFromCookieHeader(args.cookieHeader),
      ...(args.context || {}),
    },
    baseOrigin: args.baseOrigin,
  });
}

export function buildTrackedAuthHrefFromCookieHeader(args: {
  cookieHeader: string | null;
  authPath?: string;
  nextPath?: string;
  context?: CampaignCtaContext;
  authParams?: Record<string, string | null | undefined>;
  baseOrigin?: string;
}) {
  return buildTrackedAuthCtaHref({
    authPath: args.authPath,
    nextPath: args.nextPath,
    context: {
      ...readAnalyticsContextFromCookieHeader(args.cookieHeader),
      ...(args.context || {}),
    },
    authParams: args.authParams,
    baseOrigin: args.baseOrigin,
  });
}
