const LOCAL_BASE_URL = "http://localhost:3000";

function sanitizeBaseUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getAppBaseUrl(): string {
  return (
    sanitizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    sanitizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL) ||
    sanitizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    LOCAL_BASE_URL
  );
}

export function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    );
  } catch {
    return true;
  }
}
