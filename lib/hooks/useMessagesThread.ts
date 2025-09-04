"use client";
import { useCallback, useEffect, useRef, useState } from "react";

import { getMessages, type GetMessagesParams } from "@/lib/queries/messages";

export function useMessagesThread(requestId?: string, params: GetMessagesParams = {}) {
  const [data, setData] = useState<Array<{ id: string; sender_id: string; recipient_id: string; text: string; created_at: string }> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const latest = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getMessages(requestId, params);
      setData(res.data);
      latest.current = res.data?.[0]?.created_at ?? latest.current;
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [requestId, params]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load } as const;
}
