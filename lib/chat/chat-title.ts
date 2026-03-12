const UUIDISH_RE = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const SHORT_UUIDISH_RE = /^[0-9a-f]{8}(?:\.\.\.|…)?$/i;

function cleanLabel(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isLikelyUuidishLabel(
  value: string | null | undefined,
): boolean {
  const label = cleanLabel(value);
  if (!label) return false;
  if (UUIDISH_RE.test(label)) return true;
  if (SHORT_UUIDISH_RE.test(label)) return true;
  return /^[0-9a-f-]{24,}$/i.test(label);
}

export function isGenericContactLabel(
  value: string | null | undefined,
): boolean {
  return cleanLabel(value).toLowerCase() === "contacto";
}

function scoreLabel(value: string | null | undefined): number {
  const label = cleanLabel(value);
  if (!label) return 0;
  if (isLikelyUuidishLabel(label)) return 1;
  if (isGenericContactLabel(label)) return 2;
  return 3;
}

export function pickBestChatTitle(
  current: string | null | undefined,
  incoming: string | null | undefined,
  fallback = "Contacto",
): string {
  const candidates = [current, incoming, fallback];
  let best = "";
  let bestScore = -1;
  for (const candidate of candidates) {
    const normalized = cleanLabel(candidate);
    const score = scoreLabel(normalized);
    if (score > bestScore) {
      best = normalized;
      bestScore = score;
    }
  }
  return best || fallback;
}

export function getSafeChatTitle(
  rawName: string | null | undefined,
  peerId: string | null | undefined,
  fallback = "Contacto",
): string {
  const direct = cleanLabel(rawName);
  if (direct && !isLikelyUuidishLabel(direct)) return direct;
  const safeFallback = cleanLabel(fallback) || "Contacto";
  if (safeFallback) return safeFallback;
  const peer = cleanLabel(peerId);
  return peer ? `${peer.slice(0, 8)}...` : "Contacto";
}
