"use client";

import { useEffect, useRef } from "react";

import type { AnalyticsEventName } from "@/lib/analytics/schemas";
import {
  trackAnalyticsEvent,
  type AnalyticsEventParams,
} from "@/lib/analytics/tracking";

type EventTrackerProps = {
  eventName: AnalyticsEventName;
  eventParams?: AnalyticsEventParams;
};

export default function EventTracker({
  eventName,
  eventParams = {},
}: EventTrackerProps) {
  const trackedRef = useRef(false);
  const payloadKey = JSON.stringify(eventParams);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackAnalyticsEvent(eventName, eventParams);
  }, [eventName, eventParams, payloadKey]);

  return null;
}
