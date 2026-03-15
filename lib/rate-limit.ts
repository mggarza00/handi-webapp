type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

const globalBuckets = globalThis as unknown as {
  __rateLimitBuckets__?: Map<string, RateLimitEntry>;
};

const buckets: Map<string, RateLimitEntry> =
  globalBuckets.__rateLimitBuckets__ ??
  (globalBuckets.__rateLimitBuckets__ = new Map<string, RateLimitEntry>());

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetMs: windowMs };
  }
  const nextCount = existing.count + 1;
  existing.count = nextCount;
  buckets.set(key, existing);
  const remaining = Math.max(0, limit - nextCount);
  return {
    allowed: nextCount <= limit,
    remaining,
    resetMs: Math.max(0, existing.resetAt - now),
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim();
  return (
    ip ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "anon"
  );
}
