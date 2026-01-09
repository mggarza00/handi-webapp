"use client";

import * as React from "react";

import { createSupabaseBrowser } from "@/lib/supabase/client";

export function useSignedUrls(
  bucket: string,
  paths: string[],
  options: { expireSeconds?: number; refreshMarginSeconds?: number } = {},
) {
  const { expireSeconds = 600, refreshMarginSeconds = 60 } = options;
  const supabase = React.useMemo(() => createSupabaseBrowser(), []);
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const signAll = React.useCallback(async () => {
    if (!paths || paths.length === 0) {
      setUrls({});
      return;
    }
    setLoading(true);
    try {
      const out: Record<string, string> = {};
      for (const key of paths) {
        const normalized = key.replace(/^\/+/, "").replace(new RegExp(`^${bucket}/`), "");
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(normalized, expireSeconds);
        if (!error && data?.signedUrl) out[key] = data.signedUrl;
      }
      setUrls(out);
    } finally {
      setLoading(false);
    }
  }, [paths, bucket, supabase, expireSeconds]);

  const schedule = React.useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const delay = Math.max(10, (expireSeconds - refreshMarginSeconds) * 1000);
    timerRef.current = setTimeout(() => { void signAll(); }, delay);
  }, [expireSeconds, refreshMarginSeconds, signAll]);

  React.useEffect(() => {
    void signAll();
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [signAll, schedule]);

  const refresh = React.useCallback(() => { void signAll(); schedule(); }, [signAll, schedule]);

  return { urls, loading, refresh } as const;
}
