export function track(event: string, props?: Record<string, unknown>) {
  try {
    const payload = JSON.stringify({ event, props, ts: Date.now() });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json; charset=utf-8" });
      navigator.sendBeacon("/api/telemetry", blob);
      return;
    }
    // Fallback fetch (fire-and-forget)
    fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: payload,
      keepalive: true,
    }).catch(() => void 0);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[telemetry] failed to send", error);
    }
  }
}
