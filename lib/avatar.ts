export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  // Absolute URL
  if (/^https?:\/\//i.test(s)) return s;
  // If already a Supabase public path starting with /storage, prefix instance URL
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const clean = s.replace(/^\/+/, "");
  if (/^storage\/v1\/object\/public\//i.test(clean)) {
    return base ? `${base}/${clean}` : `/${clean}`;
  }
  // Otherwise, assume it's a bucket path like "avatars/..."
  // Use default public object URL
  return base ? `${base}/storage/v1/object/public/${clean}` : `/storage/v1/object/public/${clean}`;
}
