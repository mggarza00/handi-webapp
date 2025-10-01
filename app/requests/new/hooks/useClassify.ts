"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useDebounced<T extends (...args: unknown[]) => void>(
  fn: T,
  ms = 500,
): (...args: Parameters<T>) => void {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const debounced = useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fnRef.current(...args);
    }, ms);
  }, [ms]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debounced;
}

export type ClassifyIn = {
  title?: string;
  description?: string;
};

export type ClassifySuggestion = {
  category: string;
  subcategory: string; // empty string if none
  confidence: number; // 0..1
  source: "keyword" | "heuristic";
};

export function useClassify(opts: {
  title: string;
  description: string;
  enabled?: boolean;
  delayMs?: number;
  minLength?: number; // min combined length to trigger
}) {
  const { title, description, enabled = true, delayMs = 450, minLength = 3 } = opts;

  const [loading, setLoading] = useState(false);
  const [best, setBest] = useState<ClassifySuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<ClassifySuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    const t = (title || "").trim();
    const d = (description || "").trim();
    if (!enabled || (t + d).length < minLength) {
      setBest(null);
      setSuggestions([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      // cancel previous
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ title: t, description: d } satisfies ClassifyIn),
        signal: abortRef.current.signal,
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || (j?.ok as boolean) === false) {
        const detail = (j?.detail as string) || (j?.error as string) || "fetch_failed";
        throw new Error(detail);
      }
      const _best = (j?.best ?? null) as ClassifySuggestion | null;
      const _suggestions = Array.isArray(j?.suggestions)
        ? (j?.suggestions as ClassifySuggestion[])
        : Array.isArray(j?.alternatives)
          ? (j?.alternatives as ClassifySuggestion[])
          : [];
      setBest(_best);
      setSuggestions(_suggestions);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError((e as Error)?.message || "UNKNOWN_ERROR");
      setBest(null);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [title, description, enabled, minLength]);

  const debouncedRun = useDebounced(run, delayMs);

  useEffect(() => {
    debouncedRun();
  }, [debouncedRun, title, description, enabled, delayMs]);

  const refetch = useCallback(() => run(), [run]);

  return { loading, best, suggestions, error, refetch } as const;
}

