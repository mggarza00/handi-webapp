import { normalizeAvatarUrl } from "@/lib/avatar";
import {
  isGenericContactLabel,
  isLikelyUuidishLabel,
  pickBestChatTitle,
} from "@/lib/chat/chat-title";

const PLACEHOLDER_AVATARS = new Set([
  "/images/Favicon-v1-jpeg.jpg",
  "/images/LOGO_HANDI_DB.png",
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
  return !PLACEHOLDER_AVATARS.has(normalized);
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
