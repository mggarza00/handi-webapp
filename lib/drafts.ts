// lib/drafts.ts
// Helpers to persist form drafts and auth-gating flags in localStorage
// Feature-flag controlled: disable on production handi.mx domains by default.

export type DraftKey = "draft:create-service" | "draft:apply-professional";

function truthy(v: string | undefined | null): boolean {
  const s = (v || "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes" || s === "enable" || s === "enabled";
}

function getHostname(): string {
  if (typeof window !== "undefined" && window.location) return window.location.hostname || "";
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  try {
    return base ? new URL(base).hostname : "";
  } catch {
    return "";
  }
}

// Public feature flag to guard draft read/write
export function draftsEnabled(): boolean {
  // Allow explicit override via env var
  const override = process.env.NEXT_PUBLIC_ENABLE_FORM_DRAFTS;
  if (typeof override === "string" && override.trim() !== "") return truthy(override);

  const host = getHostname();
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const isPreview = /\.vercel\.app$/i.test(host);
  const isHandiProd = host === "handi.mx" || /\.handi\.mx$/i.test(host);

  if (isHandiProd) return false; // disable drafts on production domains
  if (isLocal || isPreview) return true; // enable on local/preview
  // Fallback: enable unless explicitly disabled
  return true;
}

export function readDraft<T = unknown>(key: DraftKey): T | null {
  if (typeof window === "undefined") return null;
  if (!draftsEnabled()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeDraft<T = unknown>(key: DraftKey, value: T): void {
  if (typeof window === "undefined") return;
  if (!draftsEnabled()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function clearDraft(key: DraftKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const PENDING_KEY = "pendingAutoSubmit";
const RETURN_TO_KEY = "returnTo";

export function setPendingAutoSubmit(flag: boolean): void {
  if (typeof window === "undefined") return;
  if (!draftsEnabled()) return;
  try {
    if (flag) window.localStorage.setItem(PENDING_KEY, "true");
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

export function isPendingAutoSubmit(): boolean {
  if (typeof window === "undefined") return false;
  if (!draftsEnabled()) return false;
  try {
    return window.localStorage.getItem(PENDING_KEY) === "true";
  } catch {
    return false;
  }
}

export function setReturnTo(url: string): void {
  if (typeof window === "undefined") return;
  if (!draftsEnabled()) return;
  try {
    window.localStorage.setItem(RETURN_TO_KEY, url);
  } catch {
    // ignore
  }
}

export function getReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  if (!draftsEnabled()) return null;
  try {
    return window.localStorage.getItem(RETURN_TO_KEY);
  } catch {
    return null;
  }
}

export function clearGatingFlags(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_KEY);
    window.localStorage.removeItem(RETURN_TO_KEY);
  } catch {
    // ignore
  }
}

// Remove all known draft/gating keys (useful when drafts are disabled on prod domains)
export function purgeAllDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    ([("draft:create-service" as DraftKey), ("draft:apply-professional" as DraftKey)] as DraftKey[]).forEach((k) => {
      try { window.localStorage.removeItem(k); } catch { /* ignore */ }
    });
    try { window.localStorage.removeItem(PENDING_KEY); } catch {}
    try { window.localStorage.removeItem(RETURN_TO_KEY); } catch {}
  } catch {
    // ignore
  }
}
