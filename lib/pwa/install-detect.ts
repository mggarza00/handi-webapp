// Utilities to detect PWA install/display mode and platform

type NavigatorExtended = Navigator & {
  vendor?: string;
  standalone?: boolean;
  maxTouchPoints?: number;
};

// Helpers seguros para SSR: checan window/navigator antes de usarlos
export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
    const iosStandalone = typeof navigator !== "undefined" && (navigator as NavigatorExtended).standalone === true;
    return standalone || iosStandalone;
  } catch {
    return false;
  }
}

export function isIOS(): boolean {
  try {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/i.test(ua);
  } catch {
    return false;
  }
}

export function isAndroid(): boolean {
  try {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /Android/i.test(ua);
  } catch {
    return false;
  }
}

export function getAppVersion(): string | null {
  try {
    const envVal = process.env.NEXT_PUBLIC_APP_VERSION;
    if (envVal && typeof envVal === "string") return envVal;
  } catch {
    // ignore
  }
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="app-version"]');
    const v = meta?.getAttribute("content");
    if (v) return v;
  }
  return null;
}

export function supportsBeforeInstallPrompt(): boolean {
  if (typeof window === "undefined") return false;
  // Not a perfect test, but a reasonable heuristic
  return !isIOS() && "onbeforeinstallprompt" in window;
}

export function notificationsSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

function isSafariOniOS(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    const nav = navigator as NavigatorExtended;
    const ua = nav.userAgent || "";
    const isiOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && ((nav.maxTouchPoints ?? 0) > 1));
    // Evita falsos positivos con otros navegadores en iOS
    const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
    return isiOS && isSafari;
  } catch {
    return false;
  }
}

// Named export alias for clarity at call sites
export function safeIsSafariOniOS(): boolean {
  return isSafariOniOS();
}

export function getIOSVersion(): { major: number; minor: number; patch: number } | null {
  try {
    if (typeof navigator === "undefined") return null;
    const ua = navigator.userAgent || "";
    const m = ua.match(/OS (\d+)_(\d+)?_(\d+)?/i);
    if (!m) return null;
    const [, maj, min = "0", pat = "0"] = m;
    return { major: +maj, minor: +min, patch: +pat };
  } catch {
    return null;
  }
}

export function isIOS164OrLater(): boolean {
  const v = getIOSVersion();
  if (!v) return false;
  if (v.major > 16) return true;
  if (v.major < 16) return false;
  if (v.minor > 4) return true;
  if (v.minor < 4) return false;
  return true; // 16.4.x
}

// Default export: safe iOS Safari detector (SSR-safe)
export default isSafariOniOS;
