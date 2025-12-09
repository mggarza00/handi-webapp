/**
 * Normaliza distintas variantes de rutas de avatar a una URL accesible.
 * Casos soportados:
 *  - https://... (devuelve tal cual)
 *  - /storage/v1/object/public/<bucket>/<key>
 *  - storage/v1/object/public/<bucket>/<key>
 *  - public/<bucket>/<key>
 *  - <bucket>/<key>
 */
export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  // Absolute URL
  if (/^https?:\/\//i.test(s)) return s;

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const clean = s.replace(/^\/+/, "");

  // Already a Supabase public object path
  if (/^storage\/v1\/object\/public\//i.test(clean)) {
    return base ? `${base}/${clean}` : `/${clean}`;
  }

  // Starts with optional "public/" prefix before bucket name
  const withNoPublicPrefix = clean.replace(/^public\//i, "");
  // Now assume it's bucket/key
  return base
    ? `${base}/storage/v1/object/public/${withNoPublicPrefix}`
    : `/storage/v1/object/public/${withNoPublicPrefix}`;
}

/**
 * Extrae { bucket, key } desde varias formas de ruta de almacenamiento.
 * Devuelve null si no se puede inferir.
 */
export function parseSupabaseStoragePath(url: string | null | undefined): { bucket: string; key: string } | null {
  if (!url) return null;
  const s = String(url).trim();
  if (!s || /^https?:\/\//i.test(s)) return null; // ya es absoluta
  const clean = s.replace(/^\/+/, "");

  // storage/v1/object/public/<bucket>/<key>
  const m = clean.match(/^storage\/v1\/object\/public\/([^/]+)\/(.+)$/i);
  if (m) return { bucket: m[1], key: m[2] };

  // public/<bucket>/<key>
  const m2 = clean.match(/^public\/([^/]+)\/(.+)$/i);
  if (m2) return { bucket: m2[1], key: m2[2] };

  // <bucket>/<key>
  const idx = clean.indexOf("/");
  if (idx > 0) return { bucket: clean.slice(0, idx), key: clean.slice(idx + 1) };

  return null;
}
