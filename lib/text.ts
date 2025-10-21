// Utilities for temporary text fixes in UI only (do not mutate DB values)
// Intentionally lightweight and safe for both server and client runtimes.

export function fixMojibake(input?: string | null): string {
  const s = input ?? "";
  if (!s) return "";
  // Quick detection of common UTF-8->latin1 mojibake sequences seen in app (e.g., "AÃ±os", "GalerÃ­a")
  if (!/[ÃÂ]/.test(s)) return s;
  try {
    // Node.js path: Buffer is available server-side
    // eslint-disable-next-line no-undef
    if (typeof Buffer !== "undefined") {
      // @ts-ignore Buffer global in Node; on client this path is skipped
      return Buffer.from(s, "latin1").toString("utf8");
    }
  } catch {
    // fallthrough to browser path
  }
  try {
    // Browser-safe path: rebuild bytes from char codes (0..255) and decode as UTF-8
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder("utf-8").decode(bytes);
    }
  } catch {
    /* ignore */
  }
  return s;
}

export default fixMojibake;

