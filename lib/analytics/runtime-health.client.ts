"use client";

import type {
  AnalyticsEventName,
  AnalyticsProviderTarget,
  InstrumentationDispatchStatus,
} from "@/lib/analytics/schemas";

type BrowserRuntimeObservation = {
  eventName: AnalyticsEventName;
  providerTarget: AnalyticsProviderTarget;
  dispatchStatus: InstrumentationDispatchStatus;
  routePath?: string | null;
  surfaceId?: string | null;
};

function buildPayload(observations: BrowserRuntimeObservation[]) {
  return JSON.stringify({
    observations: observations.map((observation) => ({
      event_name: observation.eventName,
      provider_target: observation.providerTarget,
      dispatch_status: observation.dispatchStatus,
      route_path:
        observation.routePath ||
        (typeof window !== "undefined" ? window.location.pathname : null),
      surface_id: observation.surfaceId || null,
    })),
  });
}

export function observeBrowserRuntimeDispatch(
  observations: BrowserRuntimeObservation[],
) {
  if (typeof window === "undefined" || observations.length === 0) return;

  const payload = buildPayload(observations);
  const url = "/api/internal/analytics/runtime-observation";

  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([payload], {
        type: "application/json; charset=utf-8",
      });
      navigator.sendBeacon(url, blob);
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: payload,
      keepalive: true,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    // Best-effort only; runtime health must never block product analytics.
  }
}
