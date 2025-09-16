// lib/drafts.ts
// Helpers to persist form drafts and auth-gating flags in localStorage

export type DraftKey = "draft:create-service" | "draft:apply-professional";

export function readDraft<T = unknown>(key: DraftKey): T | null {
  if (typeof window === "undefined") return null;
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
  try {
    if (flag) window.localStorage.setItem(PENDING_KEY, "true");
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

export function isPendingAutoSubmit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PENDING_KEY) === "true";
  } catch {
    return false;
  }
}

export function setReturnTo(url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RETURN_TO_KEY, url);
  } catch {
    // ignore
  }
}

export function getReturnTo(): string | null {
  if (typeof window === "undefined") return null;
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
