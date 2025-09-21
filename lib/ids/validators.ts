/**
 * Acepta formatos comunes: UUID v4, ULID, CUID/CUID2, NanoID (>= 10, <= 32).
 */
export function isLikelyServiceId(id: string): boolean {
  if (!id) return false;
  const s = id.trim();
  const uuidV4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ulid = /^[0-9A-HJKMNP-TV-Z]{26}$/; // Crockford base32
  const cuid = /^c[^\s]{8,}$/i;            // cuid/cuid2 (prefijo c)
  const nano = /^[0-9A-Za-z_-]{10,32}$/;   // común en NanoID
  return uuidV4.test(s) || ulid.test(s) || cuid.test(s) || nano.test(s);
}
