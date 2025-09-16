"use client";
import { useEffect, useMemo, useState } from "react";

import {
  getProfessionals,
  type ProfessionalsQuery,
} from "@/lib/queries/professionals";

export function useProfessionals(params: ProfessionalsQuery = {}) {
  const [data, setData] = useState<unknown[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const deps = useMemo(() => ({ ...params }), [params]);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);
    getProfessionals(deps)
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
  }, [deps]);

  return { data, loading, error } as const;
}
