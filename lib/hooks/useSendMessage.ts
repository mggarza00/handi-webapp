"use client";
import { useCallback, useState } from "react";

import { sendMessage, type SendMessageBody } from "@/lib/queries/messages";

export function useSendMessage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  const mutate = useCallback(async (body: SendMessageBody) => {
    setLoading(true);
    setError(null);
    setLastMessageId(null);
    try {
      const res = await sendMessage(body);
      setLastMessageId(res.data.id);
      return res;
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { send: mutate, loading, error, lastMessageId } as const;
}
