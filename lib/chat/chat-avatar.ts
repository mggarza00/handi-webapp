import { normalizeAvatarUrl } from "@/lib/avatar";
import {
  CHAT_AVATAR_PLACEHOLDER,
  hasUsableAvatar,
} from "@/lib/chat/chat-identity";

export function resolveChatAvatarSrc(
  avatarUrl: string | null | undefined,
): string {
  const normalized = normalizeAvatarUrl(avatarUrl);
  if (hasUsableAvatar(normalized)) {
    return normalized as string;
  }
  return CHAT_AVATAR_PLACEHOLDER;
}
