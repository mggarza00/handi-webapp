import { normalizeAvatarUrl } from "@/lib/avatar";

const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_BADGE = "/icons/badge-72.png";

type BuildChatPushPayloadInput = {
  conversationId: string;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  messageBody?: string | null;
  attachmentsCount?: number;
  appBaseUrl?: string | null;
};

export type ChatPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  icon: string;
  badge: string;
  data: {
    url: string;
    conversationId: string;
  };
};

function normalizeBaseUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function toAbsoluteUrl(
  value: string | null | undefined,
  appBaseUrl: string | null,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!appBaseUrl) return null;
  if (trimmed.startsWith("/")) return `${appBaseUrl}${trimmed}`;
  return `${appBaseUrl}/${trimmed}`;
}

function isInvalidIconValue(value: string | null | undefined): boolean {
  if (!value) return true;
  const lowered = value.trim().toLowerCase();
  if (!lowered) return true;
  return lowered === "null" || lowered === "undefined";
}

export function resolvePushAvatarIconUrl(
  avatarUrl: string | null | undefined,
  appBaseUrl: string | null | undefined,
): string {
  const safeBase = normalizeBaseUrl(appBaseUrl);
  const normalized = normalizeAvatarUrl(avatarUrl);
  const absoluteAvatar = toAbsoluteUrl(normalized, safeBase);
  if (absoluteAvatar && !isInvalidIconValue(absoluteAvatar))
    return absoluteAvatar;
  const fallback = toAbsoluteUrl(DEFAULT_ICON, safeBase);
  return fallback || DEFAULT_ICON;
}

function resolvePushBadgeUrl(appBaseUrl: string | null | undefined): string {
  const safeBase = normalizeBaseUrl(appBaseUrl);
  const absoluteBadge = toAbsoluteUrl(DEFAULT_BADGE, safeBase);
  return absoluteBadge || DEFAULT_BADGE;
}

export function buildChatPushPayload(
  input: BuildChatPushPayloadInput,
): ChatPushPayload {
  const appBase = normalizeBaseUrl(input.appBaseUrl);
  const url = `/mensajes/${input.conversationId}`;
  const senderName =
    typeof input.senderName === "string" ? input.senderName.trim() : "";
  const messageBody =
    typeof input.messageBody === "string" ? input.messageBody.trim() : "";
  const attachmentsCount =
    typeof input.attachmentsCount === "number"
      ? Math.max(0, input.attachmentsCount)
      : 0;
  const body =
    messageBody.slice(0, 140) ||
    (attachmentsCount > 0
      ? "Te envio un archivo"
      : "Tienes un mensaje nuevo en Handi");
  const icon = resolvePushAvatarIconUrl(input.senderAvatarUrl, appBase);
  const badge = resolvePushBadgeUrl(appBase);
  return {
    title: senderName || "Nuevo mensaje",
    body,
    url,
    tag: `thread:${input.conversationId}`,
    icon,
    badge,
    data: {
      url,
      conversationId: input.conversationId,
    },
  };
}
