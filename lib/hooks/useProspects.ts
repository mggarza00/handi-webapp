"use client";
import { useEffect, useState } from "react";

import { getProspectsForRequest } from "@/lib/queries/requests";

export function useProspects(requestId?: string) {
  const [data, setData] = useState<unknown[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!requestId) return;
    let abort = false;
    setLoading(true);
    setError(null);
    getProspectsForRequest(requestId)
      .then((res) => {
        if (!abort) setData(res.data);
      })
      .catch((e) => {
        if (!abort) setError(e as Error);
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });
    return () => {
      abort = true;
    };
  }, [requestId]);

  return { data, loading, error } as const;
}
