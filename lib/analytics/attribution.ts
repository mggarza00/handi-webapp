"use client";

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

export type AttributionTouch = AcquisitionParams & {
  captured_at: string;
  landing_path: string;
};

export type AttributionState = {
  first_touch: AttributionTouch | null;
  last_touch: AttributionTouch | null;
};

const STORAGE_KEY = "handi_attribution_v1";
const COOKIE_FIRST_KEY = "handi_attr_ft";
const COOKIE_LAST_KEY = "handi_attr_lt";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days
const STORAGE_MAX_AGE_MS = COOKIE_MAX_AGE_SECONDS * 1000;

const TRACKED_PARAMS: Array<keyof AcquisitionParams> = [
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

function sanitize(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readAcquisitionParamsFromUrl(
  searchParams: URLSearchParams,
): AcquisitionParams {
  const result: AcquisitionParams = {};
  for (const key of TRACKED_PARAMS) {
    const value = sanitize(searchParams.get(key));
    if (value) result[key] = value;
  }
  return result;
}

function hasAttributionParams(params: AcquisitionParams): boolean {
  return TRACKED_PARAMS.some((key) => Boolean(params[key]));
}

function createEmptyState(): AttributionState {
  return { first_touch: null, last_touch: null };
}

function isTouchExpired(touch: AttributionTouch | null): boolean {
  if (!touch?.captured_at) return true;
  const capturedAt = Date.parse(touch.captured_at);
  if (Number.isNaN(capturedAt)) return true;
  return Date.now() - capturedAt > STORAGE_MAX_AGE_MS;
}

function readStorageState(): AttributionState {
  if (typeof window === "undefined") return createEmptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw) as AttributionState;
    const state: AttributionState = {
      first_touch: parsed?.first_touch ?? null,
      last_touch: parsed?.last_touch ?? null,
    };
    if (isTouchExpired(state.last_touch)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return createEmptyState();
    }
    return state;
  } catch {
    return createEmptyState();
  }
}

function persistState(state: AttributionState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures.
  }

  try {
    if (state.first_touch) {
      document.cookie = `${COOKIE_FIRST_KEY}=${encodeURIComponent(
        JSON.stringify(state.first_touch),
      )}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
    }
    if (state.last_touch) {
      document.cookie = `${COOKIE_LAST_KEY}=${encodeURIComponent(
        JSON.stringify(state.last_touch),
      )}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
    }
  } catch {
    // Ignore cookie failures.
  }
}

export function captureAttributionFromCurrentUrl(): AttributionState {
  if (typeof window === "undefined") return createEmptyState();
  const params = readAcquisitionParamsFromUrl(
    new URLSearchParams(window.location.search),
  );
  const existing = readStorageState();
  if (!hasAttributionParams(params)) {
    return existing;
  }

  const touch: AttributionTouch = {
    ...params,
    captured_at: new Date().toISOString(),
    landing_path: window.location.pathname || "/",
  };

  const nextState: AttributionState = {
    first_touch: existing.first_touch ?? touch,
    last_touch: touch,
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
    for (const key of TRACKED_PARAMS) {
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
