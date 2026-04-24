import crypto from "node:crypto";

import {
  type AnalyticsContext,
  analyticsContextSchema,
  type AnalyticsEventName,
} from "@/lib/analytics/schemas";
import {
  buildServerClientId,
  parseGaClientIdFromCookieHeader,
  sendGa4MeasurementProtocolEvents,
} from "@/lib/analytics/measurement-protocol";
import { recordInstrumentationObservation } from "@/lib/analytics/runtime-health";
import { readAnalyticsContextFromRequest } from "@/lib/analytics/url-context";
import { getAdminSupabase } from "@/lib/supabase/server";

type ServerEventParamValue = string | number | boolean | null | undefined;

type ServerEventParams = Record<string, ServerEventParamValue>;

function sanitizeParams(
  params: ServerEventParams = {},
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

function buildEventId(input: {
  name: AnalyticsEventName;
  correlationId?: string | null;
  requestSeed?: string | null;
}) {
  if (input.correlationId?.trim()) return input.correlationId.trim();
  const base = [input.name, input.requestSeed || crypto.randomUUID()].join(":");
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 32);
}

function sanitizeAnalyticsContext(
  context: Partial<AnalyticsContext>,
): Partial<AnalyticsContext> {
  const parsed = analyticsContextSchema.partial().safeParse(context);
  return parsed.success ? parsed.data : {};
}

async function recordServerObservation(args: {
  eventName: AnalyticsEventName;
  dispatchStatus: "success" | "skipped" | "failed";
  routePath: string | null;
  metadata?: Record<string, string | undefined>;
}) {
  try {
    await recordInstrumentationObservation(getAdminSupabase(), {
      eventName: args.eventName,
      eventSource: "server",
      providerTarget: "ga4",
      dispatchStatus: args.dispatchStatus,
      routePath: args.routePath,
      metadata: args.metadata,
    });
  } catch {
    // Best-effort only. Runtime health must not affect confirmed analytics dispatch.
  }
}

export async function trackServerAnalyticsEvent(args: {
  name: AnalyticsEventName;
  request: Request;
  params?: ServerEventParams;
  context?: Partial<AnalyticsContext>;
  userId?: string | null;
  clientId?: string | null;
  correlationId?: string | null;
}) {
  const requestContext = sanitizeAnalyticsContext(
    readAnalyticsContextFromRequest(args.request),
  );
  const explicitContext = sanitizeAnalyticsContext(args.context || {});
  const eventId = buildEventId({
    name: args.name,
    correlationId: args.correlationId,
    requestSeed:
      explicitContext.campaign_id ||
      explicitContext.message_id ||
      explicitContext.creative_asset_id ||
      args.userId ||
      null,
  });
  const payload = sanitizeParams({
    ...requestContext,
    ...explicitContext,
    ...args.params,
    event_source: "server",
    event_id: eventId,
    correlation_id: args.correlationId || eventId,
  });
  const clientId =
    args.clientId ||
    parseGaClientIdFromCookieHeader(args.request.headers.get("cookie")) ||
    buildServerClientId(args.userId || eventId);
  const routePath = (() => {
    try {
      return new URL(args.request.url).pathname;
    } catch {
      return null;
    }
  })();

  try {
    const result = await sendGa4MeasurementProtocolEvents({
      client_id: clientId,
      user_id: args.userId || undefined,
      events: [
        {
          name: args.name,
          params: payload,
        },
      ],
    });

    await recordServerObservation({
      eventName: args.name,
      dispatchStatus: result.ok
        ? "success"
        : result.skipped
          ? "skipped"
          : "failed",
      routePath,
      metadata: {
        reason: "reason" in result ? String(result.reason) : undefined,
        detail:
          "detail" in result && typeof result.detail === "string"
            ? result.detail
            : undefined,
      },
    });

    return result;
  } catch (error) {
    await recordServerObservation({
      eventName: args.name,
      dispatchStatus: "failed",
      routePath,
      metadata: {
        detail: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return {
      ok: false as const,
      skipped: false as const,
      reason: "ga4_server_event_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }
}
