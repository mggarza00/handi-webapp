"use client";

type Ga4Value = string | number | boolean | null | undefined;

type Ga4Params = Record<string, Ga4Value>;

type GtagCommand = [string, ...unknown[]];

declare global {
  interface Window {
    dataLayer?: GtagCommand[];
    gtag?: (...args: unknown[]) => void;
  }
}

function getMeasurementId() {
  return (process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "").trim();
}

export function isGa4Enabled() {
  return getMeasurementId().length > 0;
}

function ensureGtag() {
  if (typeof window === "undefined" || !isGa4Enabled()) return null;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args as GtagCommand);
    };
  }
  return window.gtag;
}

function sanitizeParams(
  params: Ga4Params,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      if (value === null || typeof value === "undefined") return [];
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? [[key, trimmed]] : [];
      }
      return [[key, value]];
    }),
  );
}

export function configureGa4(): void {
  const gtag = ensureGtag();
  const measurementId = getMeasurementId();
  if (!gtag || !measurementId) return;
  gtag("js", new Date());
  gtag("config", measurementId, {
    send_page_view: false,
    anonymize_ip: true,
  });
}

export function trackGa4PageView(params: {
  page_path: string;
  page_title?: string;
  page_location?: string;
}): void {
  const gtag = ensureGtag();
  if (!gtag) return;
  gtag("event", "page_view", sanitizeParams(params));
}

export function trackGa4Event(name: string, params: Ga4Params = {}): void {
  const gtag = ensureGtag();
  if (!gtag) return;
  gtag("event", name, sanitizeParams(params));
}
