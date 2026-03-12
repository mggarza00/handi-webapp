import { normalizeAvatarUrl } from "@/lib/avatar";

const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_BADGE = "/icons/badge-72.png";

type BuildChatPushPayloadInput = {
  conversationId: string;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  messageBody?: string | null;
  attachmentsCount?: number;
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

export function buildChatPushPayload(
  input: BuildChatPushPayloadInput,
): ChatPushPayload {
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
  const icon = normalizeAvatarUrl(input.senderAvatarUrl) || DEFAULT_ICON;
  return {
    title: senderName || "Nuevo mensaje",
    body,
    url,
    tag: `thread:${input.conversationId}`,
    icon,
    badge: DEFAULT_BADGE,
    data: {
      url,
      conversationId: input.conversationId,
    },
  };
}
