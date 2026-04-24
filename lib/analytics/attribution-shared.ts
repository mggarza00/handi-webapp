export type AcquisitionParams = Partial<{
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  utm_id: string;
  gclid: string;
  fbclid: string;
  msclkid: string;
  ttclid: string;
}>;

export type CampaignContextParams = Partial<{
  campaign_id: string;
  channel: string;
  placement_id: string;
  message_id: string;
  variant_id: string;
  variant_name: string;
  creative_asset_id: string;
  derivative_asset_id: string;
  bundle_status: string;
  readiness_status: string;
}>;

export type AttributionTouch = AcquisitionParams & {
  captured_at: string;
  landing_path: string;
};

export type AttributionState = {
  first_touch: AttributionTouch | null;
  last_touch: AttributionTouch | null;
  campaign_context: CampaignContextParams | null;
};

export const ATTRIBUTION_STORAGE_KEY = "handi_attribution_v1";
export const ATTRIBUTION_COOKIE_FIRST_KEY = "handi_attr_ft";
export const ATTRIBUTION_COOKIE_LAST_KEY = "handi_attr_lt";
export const ATTRIBUTION_COOKIE_CAMPAIGN_CONTEXT_KEY = "handi_attr_ctx";
export const ATTRIBUTION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days
export const ATTRIBUTION_STORAGE_MAX_AGE_MS =
  ATTRIBUTION_COOKIE_MAX_AGE_SECONDS * 1000;

export const TRACKED_ACQUISITION_PARAMS: Array<keyof AcquisitionParams> = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "msclkid",
  "ttclid",
];

export const TRACKED_CAMPAIGN_PARAMS: Array<keyof CampaignContextParams> = [
  "campaign_id",
  "channel",
  "placement_id",
  "message_id",
  "variant_id",
  "variant_name",
  "creative_asset_id",
  "derivative_asset_id",
  "bundle_status",
  "readiness_status",
];

export function sanitizeAttributionValue(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readAcquisitionParamsFromSearchParams(
  searchParams: URLSearchParams,
): AcquisitionParams {
  const result: AcquisitionParams = {};
  for (const key of TRACKED_ACQUISITION_PARAMS) {
    const value = sanitizeAttributionValue(searchParams.get(key));
    if (value) result[key] = value;
  }
  return result;
}

export function readCampaignContextFromSearchParams(
  searchParams: URLSearchParams,
): CampaignContextParams {
  const result: CampaignContextParams = {};
  for (const key of TRACKED_CAMPAIGN_PARAMS) {
    const value = sanitizeAttributionValue(searchParams.get(key));
    if (value) result[key] = value;
  }
  return result;
}

export function hasAttributionParams(params: AcquisitionParams): boolean {
  return TRACKED_ACQUISITION_PARAMS.some((key) => Boolean(params[key]));
}

export function hasCampaignContextParams(
  params: CampaignContextParams,
): boolean {
  return TRACKED_CAMPAIGN_PARAMS.some((key) => Boolean(params[key]));
}

export function createEmptyAttributionState(): AttributionState {
  return { first_touch: null, last_touch: null, campaign_context: null };
}
