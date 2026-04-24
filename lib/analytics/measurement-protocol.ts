import crypto from "node:crypto";

type MeasurementProtocolValue = string | number | boolean | null | undefined;

type MeasurementProtocolParams = Record<string, MeasurementProtocolValue>;

type MeasurementProtocolEvent = {
  name: string;
  params?: MeasurementProtocolParams;
};

type MeasurementProtocolPayload = {
  client_id: string;
  user_id?: string;
  timestamp_micros?: string;
  events: MeasurementProtocolEvent[];
};

function getMeasurementId() {
  return (process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "").trim();
}

function getApiSecret() {
  return (process.env.GA4_API_SECRET || "").trim();
}

function sanitizeParams(
  params: MeasurementProtocolParams = {},
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      if (value === null || typeof value === "undefined") return [];
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? [[key, trimmed]] : [];
      }
      return [[key, value]];
    }),
  );
}

export function isGa4MeasurementProtocolEnabled() {
  return getMeasurementId().length > 0 && getApiSecret().length > 0;
}

export function parseGaClientIdFromCookieHeader(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)_ga=([^;]+)/);
  if (!match?.[1]) return null;

  try {
    const raw = decodeURIComponent(match[1]);
    const parts = raw.split(".");
    if (parts.length >= 4) {
      return `${parts[2]}.${parts[3]}`;
    }
    return raw.trim() || null;
  } catch {
    return null;
  }
}

export function buildServerClientId(seed?: string | null): string {
  const source = (seed || crypto.randomUUID()).trim();
  const digest = crypto.createHash("sha256").update(source).digest("hex");
  const left = Number.parseInt(digest.slice(0, 12), 16).toString();
  const right = Number.parseInt(digest.slice(12, 24), 16).toString();
  return `${left}.${right}`;
}

export async function sendGa4MeasurementProtocolEvents(
  payload: MeasurementProtocolPayload,
) {
  const measurementId = getMeasurementId();
  const apiSecret = getApiSecret();
  if (!measurementId || !apiSecret) {
    return {
      ok: false as const,
      skipped: true as const,
      reason: "ga4_measurement_protocol_not_configured",
    };
  }

  const body = {
    client_id: payload.client_id,
    user_id: payload.user_id,
    timestamp_micros: payload.timestamp_micros,
    events: payload.events.map((event) => ({
      name: event.name,
      params: sanitizeParams(event.params),
    })),
  };

  const response = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
      measurementId,
    )}&api_secret=${encodeURIComponent(apiSecret)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false as const,
      skipped: false as const,
      reason: "ga4_measurement_protocol_request_failed",
      status: response.status,
      detail,
    };
  }

  return {
    ok: true as const,
    skipped: false as const,
  };
}
