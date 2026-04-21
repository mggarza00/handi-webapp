"use client";

type ClarityPrimitive = string | number | boolean;

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

function getClarityProjectId() {
  return (process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || "").trim();
}

export function isClarityEnabled() {
  return getClarityProjectId().length > 0;
}

function getClarity() {
  if (typeof window === "undefined" || !isClarityEnabled()) return null;
  return typeof window.clarity === "function" ? window.clarity : null;
}

export function trackClarityEvent(name: string): void {
  const clarity = getClarity();
  if (!clarity) return;
  clarity("event", name);
}

export function setClarityTag(
  key: string,
  value: ClarityPrimitive | null | undefined,
): void {
  const clarity = getClarity();
  if (!clarity || value === null || typeof value === "undefined") return;
  const normalized = String(value).trim();
  if (!normalized) return;
  clarity("set", key, normalized);
}

export function setClarityTags(
  tags: Record<string, ClarityPrimitive | null | undefined>,
): void {
  for (const [key, value] of Object.entries(tags)) {
    setClarityTag(key, value);
  }
}
