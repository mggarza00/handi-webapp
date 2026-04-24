import {
  ATTRIBUTION_COOKIE_CAMPAIGN_CONTEXT_KEY,
  ATTRIBUTION_COOKIE_FIRST_KEY,
  ATTRIBUTION_COOKIE_LAST_KEY,
  TRACKED_ACQUISITION_PARAMS,
  TRACKED_CAMPAIGN_PARAMS,
  createEmptyAttributionState,
  readAcquisitionParamsFromSearchParams,
  readCampaignContextFromSearchParams,
  sanitizeAttributionValue,
  type AcquisitionParams,
  type AttributionState,
  type CampaignContextParams,
} from "@/lib/analytics/attribution-shared";
import type { AnalyticsContext } from "@/lib/analytics/schemas";

type UrlContextValue = string | null | undefined;

export type AnalyticsUrlContext = Partial<
  Record<keyof AnalyticsContext | keyof AcquisitionParams, UrlContextValue>
>;

function parseJsonCookieValue<T>(rawValue: string | undefined): T | null {
  if (!rawValue) return null;
  try {
    return JSON.parse(decodeURIComponent(rawValue)) as T;
  } catch {
    return null;
  }
}

export function parseCookieHeader(
  header: string | null,
): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) return [part, ""];
        return [
          part.slice(0, separatorIndex).trim(),
          part.slice(separatorIndex + 1).trim(),
        ];
      }),
  );
}

function mergeContextEntries(
  target: Record<string, string>,
  source: Record<string, UrlContextValue>,
) {
  for (const [key, value] of Object.entries(source)) {
    const normalized = sanitizeAttributionValue(
      typeof value === "string" ? value : null,
    );
    if (normalized) target[key] = normalized;
  }
  return target;
}

export function buildAnalyticsUrlContext(
  context: AnalyticsUrlContext,
): Record<string, string> {
  return mergeContextEntries({}, context);
}

export function appendAnalyticsContextToUrl(
  href: string,
  context: AnalyticsUrlContext,
  baseOrigin?: string,
): string {
  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(href);
  const base =
    baseOrigin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(href, hasProtocol ? undefined : base);
  const params = buildAnalyticsUrlContext(context);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  if (hasProtocol) return url.toString();
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildTrackedAuthHref(args: {
  authPath?: string;
  nextPath: string;
  context?: AnalyticsUrlContext;
  authParams?: Record<string, string | null | undefined>;
  baseOrigin?: string;
}): string {
  const authPath = args.authPath || "/auth/sign-in";
  const context = args.context || {};
  const nextPath = appendAnalyticsContextToUrl(
    args.nextPath,
    context,
    args.baseOrigin,
  );
  const authHref = appendAnalyticsContextToUrl(
    authPath,
    context,
    args.baseOrigin,
  );
  return appendAnalyticsContextToUrl(
    authHref,
    {
      ...args.authParams,
      next: nextPath,
    },
    args.baseOrigin,
  );
}

export function readAttributionStateFromRequest(
  req: Request,
): AttributionState {
  const cookieMap = parseCookieHeader(req.headers.get("cookie"));
  return readAttributionStateFromCookieHeaderMap(cookieMap);
}

function readAttributionStateFromCookieHeaderMap(
  cookieMap: Record<string, string>,
): AttributionState {
  const firstTouch = parseJsonCookieValue<AttributionState["first_touch"]>(
    cookieMap[ATTRIBUTION_COOKIE_FIRST_KEY],
  );
  const lastTouch = parseJsonCookieValue<AttributionState["last_touch"]>(
    cookieMap[ATTRIBUTION_COOKIE_LAST_KEY],
  );
  const campaignContext = parseJsonCookieValue<
    AttributionState["campaign_context"]
  >(cookieMap[ATTRIBUTION_COOKIE_CAMPAIGN_CONTEXT_KEY]);

  return {
    first_touch: firstTouch ?? null,
    last_touch: lastTouch ?? null,
    campaign_context: campaignContext ?? null,
  };
}

export function readAttributionStateFromCookieHeader(
  cookieHeader: string | null,
): AttributionState {
  return readAttributionStateFromCookieHeaderMap(
    parseCookieHeader(cookieHeader),
  );
}

export function readAnalyticsContextFromRequest(
  req: Request,
): AnalyticsUrlContext {
  const url = new URL(req.url);
  return readAnalyticsContext({
    searchParams: url.searchParams,
    attributionState: readAttributionStateFromRequest(req),
  });
}

export function readAnalyticsContextFromCookieHeader(
  cookieHeader: string | null,
): AnalyticsUrlContext {
  return readAnalyticsContext({
    searchParams: new URLSearchParams(),
    attributionState: readAttributionStateFromCookieHeader(cookieHeader),
  });
}

function readAnalyticsContext(args: {
  searchParams: URLSearchParams;
  attributionState: AttributionState;
}): AnalyticsUrlContext {
  const queryAcquisition = readAcquisitionParamsFromSearchParams(
    args.searchParams,
  );
  const queryCampaign = readCampaignContextFromSearchParams(args.searchParams);
  const attributionState = args.attributionState;
  const lastTouch = attributionState.last_touch ?? attributionState.first_touch;
  const context: Record<string, string> = {};

  mergeContextEntries(context, lastTouch || {});
  mergeContextEntries(context, attributionState.campaign_context || {});
  mergeContextEntries(context, queryAcquisition);
  mergeContextEntries(context, queryCampaign);

  return context;
}

export function extractCampaignContext(
  context: AnalyticsUrlContext,
): CampaignContextParams {
  const result: CampaignContextParams = {};
  for (const key of TRACKED_CAMPAIGN_PARAMS) {
    const value = sanitizeAttributionValue(context[key]);
    if (value) result[key] = value;
  }
  return result;
}

export function extractAcquisitionParams(
  context: AnalyticsUrlContext,
): AcquisitionParams {
  const result: AcquisitionParams = {};
  for (const key of TRACKED_ACQUISITION_PARAMS) {
    const value = sanitizeAttributionValue(context[key]);
    if (value) result[key] = value;
  }
  return result;
}

export function getEmptyRequestAttributionState(): AttributionState {
  return createEmptyAttributionState();
}
