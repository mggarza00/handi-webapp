import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  EVENT_CATALOG,
  getEventCatalogItem,
  type InstrumentationJourney,
} from "@/lib/analytics/event-catalog";
import {
  INSTRUMENTATION_SURFACES,
  type InstrumentationSurface,
} from "@/lib/analytics/instrumentation-audit";
import {
  analyticsEventNameSchema,
  analyticsEventSourceSchema,
  analyticsProviderTargetSchema,
  instrumentationDispatchStatusSchema,
  type AnalyticsEventName,
  type AnalyticsEventSource,
  type AnalyticsProviderTarget,
  type InstrumentationDispatchStatus,
  type InstrumentationHealthStatus,
} from "@/lib/analytics/schemas";
import type { Database, Json } from "@/types/supabase";

export const INSTRUMENTATION_HEALTHY_WINDOW_HOURS = 72;
export const INSTRUMENTATION_STALE_WINDOW_DAYS = 14;

const runtimeObservationRowSchema = z.object({
  id: z.string().uuid().optional(),
  event_name: analyticsEventNameSchema,
  event_source: analyticsEventSourceSchema,
  provider_target: analyticsProviderTargetSchema,
  journey: z.string().trim().min(1).nullable().optional(),
  last_surface_id: z.string().trim().min(1).nullable().optional(),
  last_route_path: z.string().trim().min(1).nullable().optional(),
  last_dispatch_status: instrumentationDispatchStatusSchema,
  last_observed_at: z.string().trim().min(1),
  last_success_at: z.string().trim().min(1).nullable().optional(),
  last_failure_at: z.string().trim().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  created_at: z.string().trim().min(1).optional(),
  updated_at: z.string().trim().min(1).optional(),
});

type RuntimeObservationRow = z.infer<typeof runtimeObservationRowSchema>;

export type RuntimeObservationInput = {
  eventName: AnalyticsEventName;
  eventSource: AnalyticsEventSource;
  providerTarget: AnalyticsProviderTarget;
  dispatchStatus: InstrumentationDispatchStatus;
  routePath?: string | null;
  surfaceId?: string | null;
  observedAt?: string;
  metadata?: Record<string, Json | undefined>;
};

export type InstrumentationEventHealth = {
  name: AnalyticsEventName;
  source: AnalyticsEventSource | "hybrid";
  journey: InstrumentationJourney;
  status: InstrumentationHealthStatus;
  lastObservedAt: string | null;
  lastSuccessAt: string | null;
  lastRoutePath: string | null;
  lastSurfaceId: string | null;
  providerStates: Array<{
    providerTarget: AnalyticsProviderTarget;
    dispatchStatus: InstrumentationDispatchStatus;
    lastObservedAt: string;
    lastSuccessAt: string | null;
  }>;
  notes: string[];
};

export type InstrumentationJourneyHealth = {
  journey: InstrumentationJourney;
  status: InstrumentationHealthStatus;
  healthyEvents: number;
  staleEvents: number;
  missingEvents: number;
  partialEvents: number;
  lastObservedAt: string | null;
};

export type InstrumentationSurfaceHealth = {
  id: string;
  label: string;
  route: string;
  coverageStatus: InstrumentationSurface["coverageStatus"];
  builderStatus: InstrumentationSurface["builderStatus"];
  runtimeStatus: InstrumentationHealthStatus;
  events: string[];
  lastObservedAt: string | null;
  notes: string[];
};

export type RuntimeInstrumentationHealthSnapshot = {
  available: boolean;
  generatedAt: string;
  policy: {
    healthyWindowHours: number;
    staleWindowDays: number;
    persistenceModel: "latest_observation_rollup";
  };
  summary: {
    totalInstrumentedEvents: number;
    healthyEvents: number;
    partialEvents: number;
    staleEvents: number;
    missingEvents: number;
    unknownEvents: number;
    browserEvents: number;
    serverEvents: number;
  };
  events: InstrumentationEventHealth[];
  journeys: InstrumentationJourneyHealth[];
  surfaces: InstrumentationSurfaceHealth[];
  error?: string;
};

function toIsoDate(value?: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function hoursSince(value?: string | null) {
  const parsed = toIsoDate(value);
  if (!parsed) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(parsed).getTime()) / (1000 * 60 * 60);
}

function expectedProviderTargets(
  eventName: AnalyticsEventName,
): AnalyticsProviderTarget[] {
  const item = getEventCatalogItem(eventName);
  return item.providers.flatMap((provider) => {
    if (provider === "ga4") return ["ga4"] as const;
    if (provider === "clarity") return ["clarity"] as const;
    return [];
  });
}

function buildEventNotes(
  item: (typeof EVENT_CATALOG)[number],
  rows: RuntimeObservationRow[],
): string[] {
  const notes: string[] = [];
  const expectedTargets = expectedProviderTargets(item.name);
  const successRows = rows.filter((row) => row.last_success_at);
  const observedTargets = new Set(rows.map((row) => row.provider_target));

  for (const providerTarget of expectedTargets) {
    if (!observedTargets.has(providerTarget)) {
      notes.push(`No runtime observation for ${providerTarget}.`);
    }
  }

  if (!successRows.length && rows.length > 0) {
    const statuses = Array.from(
      new Set(rows.map((row) => row.last_dispatch_status)),
    );
    notes.push(`Observed only with ${statuses.join(", ")} dispatch state.`);
  }

  return notes;
}

function determineEventHealth(
  item: (typeof EVENT_CATALOG)[number],
  rows: RuntimeObservationRow[],
): InstrumentationEventHealth {
  if (item.status !== "instrumented") {
    return {
      name: item.name,
      source: item.source,
      journey: item.journey,
      status: "unknown",
      lastObservedAt: null,
      lastSuccessAt: null,
      lastRoutePath: null,
      lastSurfaceId: null,
      providerStates: [],
      notes: ["Event catalog entry is not marked as instrumented yet."],
    };
  }

  const orderedRows = [...rows].sort((left, right) => {
    const leftValue = new Date(left.last_observed_at).getTime();
    const rightValue = new Date(right.last_observed_at).getTime();
    return rightValue - leftValue;
  });
  const lastObservedAt = orderedRows[0]?.last_observed_at || null;
  const lastRoutePath = orderedRows[0]?.last_route_path || null;
  const lastSurfaceId = orderedRows[0]?.last_surface_id || null;
  const successRows = orderedRows.filter((row) => row.last_success_at);
  const lastSuccessAt =
    successRows
      .map((row) => row.last_success_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) || null;
  const successHours = hoursSince(lastSuccessAt);
  const recentObservationHours = hoursSince(lastObservedAt);
  const expectedTargets = expectedProviderTargets(item.name);
  const providerStates = orderedRows.map((row) => ({
    providerTarget: row.provider_target,
    dispatchStatus: row.last_dispatch_status,
    lastObservedAt: row.last_observed_at,
    lastSuccessAt: row.last_success_at || null,
  }));
  const notes = buildEventNotes(item, orderedRows);

  let status: InstrumentationHealthStatus = "missing";

  if (!orderedRows.length) {
    status = "missing";
    notes.push("No runtime observation recorded yet.");
  } else if (successHours <= INSTRUMENTATION_HEALTHY_WINDOW_HOURS) {
    const healthyTargets = expectedTargets.filter((providerTarget) =>
      orderedRows.some(
        (row) =>
          row.provider_target === providerTarget &&
          hoursSince(row.last_success_at) <=
            INSTRUMENTATION_HEALTHY_WINDOW_HOURS,
      ),
    );
    status =
      healthyTargets.length === expectedTargets.length ? "healthy" : "partial";
  } else if (recentObservationHours <= INSTRUMENTATION_HEALTHY_WINDOW_HOURS) {
    status = "partial";
  } else if (successHours <= INSTRUMENTATION_STALE_WINDOW_DAYS * 24) {
    status = "stale";
  } else if (recentObservationHours <= INSTRUMENTATION_STALE_WINDOW_DAYS * 24) {
    status = "partial";
  }

  return {
    name: item.name,
    source: item.source,
    journey: item.journey,
    status,
    lastObservedAt: toIsoDate(lastObservedAt),
    lastSuccessAt: toIsoDate(lastSuccessAt),
    lastRoutePath,
    lastSurfaceId,
    providerStates,
    notes,
  };
}

function combineStatuses(
  statuses: InstrumentationHealthStatus[],
): InstrumentationHealthStatus {
  if (!statuses.length) return "unknown";
  if (statuses.every((status) => status === "healthy")) return "healthy";
  if (statuses.some((status) => status === "healthy")) return "partial";
  if (statuses.some((status) => status === "partial")) return "partial";
  if (statuses.every((status) => status === "stale")) return "stale";
  if (statuses.every((status) => status === "missing")) return "missing";
  if (statuses.some((status) => status === "stale")) return "stale";
  if (statuses.some((status) => status === "missing")) return "missing";
  return "unknown";
}

function buildJourneyHealth(
  eventHealth: InstrumentationEventHealth[],
): InstrumentationJourneyHealth[] {
  const journeys = Array.from(
    new Set(EVENT_CATALOG.map((event) => event.journey)),
  );
  return journeys.map((journey) => {
    const scoped = eventHealth.filter((event) => event.journey === journey);
    const lastObservedAt =
      scoped
        .map((event) => event.lastObservedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) || null;
    return {
      journey,
      status: combineStatuses(scoped.map((event) => event.status)),
      healthyEvents: scoped.filter((event) => event.status === "healthy")
        .length,
      partialEvents: scoped.filter((event) => event.status === "partial")
        .length,
      staleEvents: scoped.filter((event) => event.status === "stale").length,
      missingEvents: scoped.filter((event) => event.status === "missing")
        .length,
      lastObservedAt,
    };
  });
}

function buildSurfaceHealth(
  eventHealth: InstrumentationEventHealth[],
): InstrumentationSurfaceHealth[] {
  const byName = new Map(eventHealth.map((event) => [event.name, event]));
  return INSTRUMENTATION_SURFACES.map((surface) => {
    const scoped = surface.events
      .map((eventName) => byName.get(eventName as AnalyticsEventName))
      .filter((value): value is InstrumentationEventHealth => Boolean(value));
    const lastObservedAt =
      scoped
        .map((event) => event.lastObservedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) || null;
    const notes = scoped.flatMap((event) =>
      event.notes.map((note) => `${event.name}: ${note}`),
    );

    return {
      id: surface.id,
      label: surface.label,
      route: surface.route,
      coverageStatus: surface.coverageStatus,
      builderStatus: surface.builderStatus,
      runtimeStatus: combineStatuses(scoped.map((event) => event.status)),
      events: surface.events,
      lastObservedAt,
      notes,
    };
  });
}

export async function recordInstrumentationObservation(
  admin: SupabaseClient<Database>,
  input: RuntimeObservationInput,
) {
  const catalogItem = getEventCatalogItem(input.eventName);
  const observedAt = toIsoDate(input.observedAt) || new Date().toISOString();

  try {
    const row = {
      event_name: input.eventName,
      event_source: input.eventSource,
      provider_target: input.providerTarget,
      journey: catalogItem?.journey || null,
      last_surface_id: input.surfaceId || null,
      last_route_path: input.routePath || null,
      last_dispatch_status: input.dispatchStatus,
      last_observed_at: observedAt,
      last_success_at:
        input.dispatchStatus === "success" ? observedAt : undefined,
      last_failure_at:
        input.dispatchStatus === "failed" ? observedAt : undefined,
      metadata: input.metadata || {},
      updated_at: observedAt,
    };

    const { error } = await admin
      .from("instrumentation_runtime_observations")
      .upsert(row, {
        onConflict: "event_name,event_source,provider_target",
      });

    if (error) {
      console.warn(
        "[instrumentation-runtime-health] failed to persist observation",
        error.message,
      );
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    console.warn(
      "[instrumentation-runtime-health] observation write failed",
      detail,
    );
  }
}

export async function getRuntimeInstrumentationHealthSnapshot(
  admin: SupabaseClient<Database>,
): Promise<RuntimeInstrumentationHealthSnapshot> {
  const generatedAt = new Date().toISOString();

  try {
    const { data, error } = await admin
      .from("instrumentation_runtime_observations")
      .select(
        "id,event_name,event_source,provider_target,journey,last_surface_id,last_route_path,last_dispatch_status,last_observed_at,last_success_at,last_failure_at,metadata,created_at,updated_at",
      );

    if (error) throw new Error(error.message);

    const observations = (Array.isArray(data) ? data : [])
      .map((row) => runtimeObservationRowSchema.safeParse(row))
      .flatMap((parsed) => (parsed.success ? [parsed.data] : []));

    const observationMap = new Map<
      AnalyticsEventName,
      RuntimeObservationRow[]
    >();
    for (const observation of observations) {
      const current = observationMap.get(observation.event_name) || [];
      current.push(observation);
      observationMap.set(observation.event_name, current);
    }

    const events = EVENT_CATALOG.map((item) =>
      determineEventHealth(item, observationMap.get(item.name) || []),
    );
    const journeys = buildJourneyHealth(events);
    const surfaces = buildSurfaceHealth(events);

    return {
      available: true,
      generatedAt,
      policy: {
        healthyWindowHours: INSTRUMENTATION_HEALTHY_WINDOW_HOURS,
        staleWindowDays: INSTRUMENTATION_STALE_WINDOW_DAYS,
        persistenceModel: "latest_observation_rollup",
      },
      summary: {
        totalInstrumentedEvents: events.length,
        healthyEvents: events.filter((event) => event.status === "healthy")
          .length,
        partialEvents: events.filter((event) => event.status === "partial")
          .length,
        staleEvents: events.filter((event) => event.status === "stale").length,
        missingEvents: events.filter((event) => event.status === "missing")
          .length,
        unknownEvents: events.filter((event) => event.status === "unknown")
          .length,
        browserEvents: events.filter((event) => event.source === "browser")
          .length,
        serverEvents: events.filter((event) => event.source === "server")
          .length,
      },
      events,
      journeys,
      surfaces,
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "failed_to_build_runtime_health";
    return {
      available: false,
      generatedAt,
      policy: {
        healthyWindowHours: INSTRUMENTATION_HEALTHY_WINDOW_HOURS,
        staleWindowDays: INSTRUMENTATION_STALE_WINDOW_DAYS,
        persistenceModel: "latest_observation_rollup",
      },
      summary: {
        totalInstrumentedEvents: EVENT_CATALOG.length,
        healthyEvents: 0,
        partialEvents: 0,
        staleEvents: 0,
        missingEvents: 0,
        unknownEvents: EVENT_CATALOG.length,
        browserEvents: EVENT_CATALOG.filter(
          (event) => event.source === "browser",
        ).length,
        serverEvents: EVENT_CATALOG.filter((event) => event.source === "server")
          .length,
      },
      events: EVENT_CATALOG.map((item) => ({
        name: item.name,
        source: item.source,
        journey: item.journey,
        status: "unknown",
        lastObservedAt: null,
        lastSuccessAt: null,
        lastRoutePath: null,
        lastSurfaceId: null,
        providerStates: [],
        notes: ["Runtime health table is unavailable in this environment."],
      })),
      journeys: buildJourneyHealth([]),
      surfaces: INSTRUMENTATION_SURFACES.map((surface) => ({
        id: surface.id,
        label: surface.label,
        route: surface.route,
        coverageStatus: surface.coverageStatus,
        builderStatus: surface.builderStatus,
        runtimeStatus: "unknown",
        events: surface.events,
        lastObservedAt: null,
        notes: ["Runtime health table is unavailable in this environment."],
      })),
      error: detail,
    };
  }
}
