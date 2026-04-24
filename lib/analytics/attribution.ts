"use client";

import {
  ATTRIBUTION_COOKIE_CAMPAIGN_CONTEXT_KEY,
  ATTRIBUTION_COOKIE_FIRST_KEY,
  ATTRIBUTION_COOKIE_LAST_KEY,
  ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
  ATTRIBUTION_STORAGE_KEY,
  ATTRIBUTION_STORAGE_MAX_AGE_MS,
  TRACKED_ACQUISITION_PARAMS,
  TRACKED_CAMPAIGN_PARAMS,
  createEmptyAttributionState,
  hasAttributionParams,
  hasCampaignContextParams,
  readAcquisitionParamsFromSearchParams,
  readCampaignContextFromSearchParams,
  type AttributionState,
  type AttributionTouch,
} from "@/lib/analytics/attribution-shared";

function isTouchExpired(touch: AttributionTouch | null): boolean {
  if (!touch?.captured_at) return true;
  const capturedAt = Date.parse(touch.captured_at);
  if (Number.isNaN(capturedAt)) return true;
  return Date.now() - capturedAt > ATTRIBUTION_STORAGE_MAX_AGE_MS;
}

function readStorageState(): AttributionState {
  if (typeof window === "undefined") return createEmptyAttributionState();
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return createEmptyAttributionState();
    const parsed = JSON.parse(raw) as AttributionState;
    const state: AttributionState = {
      first_touch: parsed?.first_touch ?? null,
      last_touch: parsed?.last_touch ?? null,
      campaign_context: parsed?.campaign_context ?? null,
    };
    if (isTouchExpired(state.last_touch)) {
      window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      return createEmptyAttributionState();
    }
    return state;
  } catch {
    return createEmptyAttributionState();
  }
}

function persistState(state: AttributionState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures.
  }

  try {
    if (state.first_touch) {
      document.cookie = `${ATTRIBUTION_COOKIE_FIRST_KEY}=${encodeURIComponent(
        JSON.stringify(state.first_touch),
      )}; Max-Age=${ATTRIBUTION_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
    }
    if (state.last_touch) {
      document.cookie = `${ATTRIBUTION_COOKIE_LAST_KEY}=${encodeURIComponent(
        JSON.stringify(state.last_touch),
      )}; Max-Age=${ATTRIBUTION_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
    }
    if (state.campaign_context) {
      document.cookie = `${ATTRIBUTION_COOKIE_CAMPAIGN_CONTEXT_KEY}=${encodeURIComponent(
        JSON.stringify(state.campaign_context),
      )}; Max-Age=${ATTRIBUTION_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
    }
  } catch {
    // Ignore cookie failures.
  }
}

export function captureAttributionFromCurrentUrl(): AttributionState {
  if (typeof window === "undefined") return createEmptyAttributionState();
  const searchParams = new URLSearchParams(window.location.search);
  const params = readAcquisitionParamsFromSearchParams(searchParams);
  const campaignContext = readCampaignContextFromSearchParams(searchParams);
  const existing = readStorageState();
  if (
    !hasAttributionParams(params) &&
    !hasCampaignContextParams(campaignContext)
  ) {
    return existing;
  }

  const touch: AttributionTouch = {
    ...params,
    captured_at: new Date().toISOString(),
    landing_path: window.location.pathname || "/",
  };

  const nextState: AttributionState = {
    first_touch: existing.first_touch ?? touch,
    last_touch: hasAttributionParams(params) ? touch : existing.last_touch,
    campaign_context: hasCampaignContextParams(campaignContext)
      ? campaignContext
      : existing.campaign_context,
  };
  persistState(nextState);
  return nextState;
}

export function getAttributionState(): AttributionState {
  return readStorageState();
}

export function getAttributionEventPayload(): Record<string, string> {
  const state = getAttributionState();
  const payload: Record<string, string> = {};
  const addTouch = (
    prefix: "first" | "last",
    touch: AttributionTouch | null,
  ) => {
    if (!touch) return;
    for (const key of TRACKED_ACQUISITION_PARAMS) {
      const value = touch[key];
      if (!value) continue;
      payload[`attribution_${prefix}_${key}`] = value;
    }
    payload[`attribution_${prefix}_captured_at`] = touch.captured_at;
    payload[`attribution_${prefix}_landing_path`] = touch.landing_path;
  };

  addTouch("first", state.first_touch);
  addTouch("last", state.last_touch);
  return payload;
}

export function getCampaignContextPayload(): Record<string, string> {
  const state = getAttributionState();
  const payload: Record<string, string> = {};
  for (const key of TRACKED_CAMPAIGN_PARAMS) {
    const value = state.campaign_context?.[key];
    if (value) payload[key] = value;
  }
  return payload;
}
