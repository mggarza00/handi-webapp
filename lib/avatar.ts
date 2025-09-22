export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.replace(/^\/+/, "");
  return `/api/avatar/${encodeURIComponent(path)}`;
}