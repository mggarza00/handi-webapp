"use client";
import { useRouter } from "next/navigation";

import ChatPanel from "@/components/chat/ChatPanel";

export default function ConversationClient({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  return (
    <ChatPanel
      conversationId={conversationId}
      onClose={() => router.push("/messages")}
      mode="page"
    />
  );
}
