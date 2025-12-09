// hooks/useFormDraft.ts
"use client";

import * as React from "react";
import type { UseFormReset, UseFormWatch } from "react-hook-form";
import { draftsEnabled, clearDraftKey } from "@/lib/drafts";

type Options = {
  debounceMs?: number;
};

/**
 * Persist and hydrate form drafts in localStorage when drafts are enabled.
 * In production on handi.mx, this hook does NOT read or write and will purge
 * any existing key on mount.
 */
export function useFormDraft<Form extends Record<string, unknown>>(
  key: string,
  watch: UseFormWatch<Form>,
  reset: UseFormReset<Form>,
  opts?: Options,
) {
  const enabled = React.useMemo(() => draftsEnabled(), []);
  const debounceMs = opts?.debounceMs ?? 400;

  // On mount, hydrate from localStorage if enabled; otherwise purge any stale key
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!enabled) {
      // En producción: limpia y no intentes leer/escribir
      try { clearDraftKey(key); } catch { /* ignore */ }
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw) reset(JSON.parse(raw) as Form);
    } catch {
      // ignore storage errors / invalid JSON
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  // Debounced persist via watch subscription
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!enabled) return;
    const wait = Math.max(50, debounceMs);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = watch((vals) => {
      try { if (timer) clearTimeout(timer); } catch { /* ignore */ }
      timer = setTimeout(() => {
        try { localStorage.setItem(key, JSON.stringify(vals)); } catch { /* ignore */ }
      }, wait);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.unsubscribe();
    };
  }, [enabled, watch, key, debounceMs]);

  const clear = React.useCallback(() => {
    clearDraftKey(key);
  }, [key]);

  return { enabled, clear } as const;
}
