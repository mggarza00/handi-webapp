import { normalizeAvatarUrl } from "@/lib/avatar";
import {
  isGenericContactLabel,
  isLikelyUuidishLabel,
  pickBestChatTitle,
} from "@/lib/chat/chat-title";

export const CHAT_AVATAR_PLACEHOLDER = "/images/handifav_sinfondo.png";

const PLACEHOLDER_AVATAR_FILENAMES = new Set([
  "favicon-v1-jpeg.jpg",
  "logo_handi_db.png",
  "handifav_sinfondo.png",
]);

export type ChatIdentity = {
  title?: string | null;
  avatarUrl?: string | null;
  otherLastActiveAt?: string | null;
};

export function isPlaceholderChatTitle(
  value: string | null | undefined,
): boolean {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return true;
  return isGenericContactLabel(trimmed) || isLikelyUuidishLabel(trimmed);
}

export function hasUsableAvatar(value: string | null | undefined): boolean {
  const normalized = normalizeAvatarUrl(value);
  if (!normalized) return false;
  return !isPlaceholderAvatar(value);
}

export function isPlaceholderAvatar(value: string | null | undefined): boolean {
  const raw = typeof value === "string" ? value.trim() : "";
  const normalized = normalizeAvatarUrl(value);
  const candidates = [raw, normalized].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  const lowerCandidates = new Set<string>();
  for (const candidate of candidates) {
    const lowered = candidate.toLowerCase();
    lowerCandidates.add(lowered);
    try {
      const parsed = new URL(candidate, "http://placeholder.local");
      lowerCandidates.add(parsed.pathname.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  for (const candidate of lowerCandidates) {
    for (const filename of PLACEHOLDER_AVATAR_FILENAMES) {
      if (candidate.endsWith(`/images/${filename}`)) return true;
      if (candidate.endsWith(`/${filename}`)) return true;
      if (candidate.includes(`/storage/v1/object/public/images/${filename}`))
        return true;
    }
  }
  return false;
}

function pickBetterAvatar(
  current: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  const currentNorm = normalizeAvatarUrl(current);
  const incomingNorm = normalizeAvatarUrl(incoming);
  if (hasUsableAvatar(incomingNorm)) return incomingNorm;
  if (hasUsableAvatar(currentNorm)) return currentNorm;
  if (currentNorm) return currentNorm;
  if (incomingNorm) return incomingNorm;
  return null;
}

export function pickBetterChatIdentity(
  current: ChatIdentity,
  incoming: ChatIdentity,
): Required<ChatIdentity> {
  const title = pickBestChatTitle(current.title, incoming.title, "Contacto");
  const avatarUrl = pickBetterAvatar(current.avatarUrl, incoming.avatarUrl);
  const otherLastActiveAt =
    (typeof incoming.otherLastActiveAt === "string" &&
    incoming.otherLastActiveAt.trim().length
      ? incoming.otherLastActiveAt
      : null) ??
    (typeof current.otherLastActiveAt === "string" &&
    current.otherLastActiveAt.trim().length
      ? current.otherLastActiveAt
      : null) ??
    null;
  return {
    title,
    avatarUrl,
    otherLastActiveAt,
  };
}
